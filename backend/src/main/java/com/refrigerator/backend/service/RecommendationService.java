package com.refrigerator.backend.service;

import com.refrigerator.backend.domain.InventoryItem;
import com.refrigerator.backend.domain.User;
import com.refrigerator.backend.domain.UserPreference;
import com.refrigerator.backend.dto.MenuOption;
import com.refrigerator.backend.dto.RecommendationRequest;
import com.refrigerator.backend.dto.RecommendationResponse;
import com.refrigerator.backend.repository.InventoryItemRepository;
import com.refrigerator.backend.repository.UserRepository;
import com.refrigerator.backend.repository.UserPreferenceRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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
        return llmClient.recommendMenus(effectiveRequest, inventory)
                .map(options -> new RecommendationResponse("menu_options", options))
                .orElseGet(() -> mockRecommendation(inventory, effectiveRequest.ingredients()));
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
        return new RecommendationRequest(request.userId(), religious, vegetarian, cuisine, request.ingredients());
    }

    private String chooseAnswer(String current, String saved) {
        return StringUtils.hasText(current) ? current.trim() : saved;
    }

    private RecommendationResponse mockRecommendation(List<InventoryItem> inventory, List<String> requestedIngredients) {
        List<String> names = inventory.stream().map(InventoryItem::getName).toList();
        if (names.isEmpty() && requestedIngredients != null) {
            names = requestedIngredients;
        }
        String firstMenu = names.stream().anyMatch("두부"::equals)
                ? "두부 된장찌개"
                : "김치볶음밥";

        return new RecommendationResponse(
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
