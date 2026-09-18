package com.refrigerator.backend.service;

import com.refrigerator.backend.domain.InventoryItem;
import com.refrigerator.backend.domain.User;
import com.refrigerator.backend.domain.UserPreference;
import com.refrigerator.backend.dto.MenuOption;
import com.refrigerator.backend.dto.MenuRecipeRequest;
import com.refrigerator.backend.dto.MenuRecipeResponse;
import com.refrigerator.backend.dto.RecommendationRequest;
import com.refrigerator.backend.dto.RecommendationResponse;
import com.refrigerator.backend.repository.InventoryItemRepository;
import com.refrigerator.backend.repository.UserRepository;
import com.refrigerator.backend.repository.UserPreferenceRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecommendationService {

    private final InventoryItemRepository inventoryItemRepository;
    private final UserRepository userRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final LlmClient llmClient;

    public RecommendationService(
            InventoryItemRepository inventoryItemRepository,
            UserRepository userRepository,
            UserPreferenceRepository userPreferenceRepository,
            LlmClient llmClient
    ) {
        this.inventoryItemRepository = inventoryItemRepository;
        this.userRepository = userRepository;
        this.userPreferenceRepository = userPreferenceRepository;
        this.llmClient = llmClient;
    }

    @Transactional
    public RecommendationResponse recommend(RecommendationRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("recommendation request is required");
        }

        User user = findOrCreateUser(request.userId());
        UserPreference preference = findOrCreatePreference(user);
        RecommendationRequest effectiveRequest = mergeWithSavedAnswers(request, preference);
        saveGuidedAnswers(preference, effectiveRequest);
        List<InventoryItem> inventory = resolveInventory(user);
        if (inventory.isEmpty() && (request.ingredients() == null || request.ingredients().isEmpty())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "추천하려면 소비기한이 지나지 않은 냉장고 재료가 필요합니다."
            );
        }
        return llmClient.recommendMenus(effectiveRequest, inventory)
                .map(options -> new RecommendationResponse(user.getId(), "menu_options", options))
                .orElseGet(() -> {
                    if (llmClient.isConfigured() || StringUtils.hasText(request.message())
                            || (request.excludedMenus() != null && !request.excludedMenus().isEmpty())) {
                        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                                "새 메뉴를 추천하지 못했습니다. 전북대 LLM 연결을 확인하고 다시 시도해 주세요.");
                    }
                    return mockRecommendation(user.getId(), inventory, effectiveRequest.ingredients());
                });
    }

    @Transactional(readOnly = true)
    public MenuRecipeResponse recipe(MenuRecipeRequest request) {
        if (request == null || request.userId() == null || !StringUtils.hasText(request.menuName())
                || request.menuName().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "사용자와 선택한 메뉴가 필요합니다.");
        }
        if (!llmClient.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "전북대 LLM 키를 설정해 주세요.");
        }
        User user = findOrCreateUser(request.userId());
        UserPreference preference = userPreferenceRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "먼저 세 가지 질문에 답해 주세요."));
        return llmClient.explainRecipe(request, preference, resolveInventory(user))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "조리법을 가져오지 못했습니다. 다시 시도해 주세요."));
    }

    private void saveGuidedAnswers(UserPreference preference, RecommendationRequest request) {
        preference.updateGuidedAnswers(
                request.religiousAnswer().trim(),
                request.vegetarianAnswer().trim(),
                request.cuisineAnswer().trim()
        );
        userPreferenceRepository.save(preference);
    }

    private UserPreference findOrCreatePreference(User user) {
        return userPreferenceRepository.findByUserId(user.getId())
                .orElseGet(() -> new UserPreference(user));
    }

    private RecommendationRequest mergeWithSavedAnswers(
            RecommendationRequest request,
            UserPreference preference
    ) {
        String religious = chooseAnswer(request.religiousAnswer(), preference.getReligiousRestriction());
        String vegetarian = chooseAnswer(request.vegetarianAnswer(), preference.getVegetarianType());
        String cuisine = chooseAnswer(request.cuisineAnswer(), preference.getPreferredCuisine());
        if (!StringUtils.hasText(religious) || !StringUtils.hasText(vegetarian) || !StringUtils.hasText(cuisine)) {
            throw new IllegalArgumentException(
                    "religiousAnswer, vegetarianAnswer, and cuisineAnswer are required for the first recommendation"
            );
        }
        return new RecommendationRequest(request.userId(), religious, vegetarian, cuisine, request.ingredients(),
                request.message(), request.excludedMenus());
    }

    private String chooseAnswer(String current, String saved) {
        return StringUtils.hasText(current) ? current.trim() : saved;
    }

    private RecommendationResponse mockRecommendation(Long userId, List<InventoryItem> inventory, List<String> requestedIngredients) {
        List<String> names = inventory.stream().map(InventoryItem::getName).toList();
        if (names.isEmpty() && requestedIngredients != null) {
            names = requestedIngredients;
        }
        String firstMenu = names.stream().anyMatch("두부"::equals)
                ? "두부 된장찌개"
                : "김치볶음밥";

        return new RecommendationResponse(
                userId,
                "menu_options",
                List.of(
                        new MenuOption(firstMenu),
                        new MenuOption(firstMenu.equals("김치볶음밥") ? "두부 된장찌개" : "김치볶음밥"),
                        new MenuOption("계란 채소볶음"),
                        new MenuOption("닭가슴살 덮밥")
                )
        );
    }

    private List<InventoryItem> resolveInventory(User user) {
        List<InventoryItem> inventory = new java.util.ArrayList<>();
        inventory.addAll(inventoryItemRepository
                .findByUserIdAndExpiryGreaterThanEqualOrderByExpiryAsc(user.getId(), LocalDate.now()));
        return inventory;
    }

    private User findOrCreateUser(Long userId) {
        if (userId != null) {
            return userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("user not found: " + userId));
        }
        return userRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> userRepository.save(new User("demo-user")));
    }

}
