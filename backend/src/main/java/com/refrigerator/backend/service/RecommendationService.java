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
        validate(request);

        User user = findOrCreateUser(request.userId());
        saveGuidedAnswers(user, request);
        List<InventoryItem> inventory = resolveInventory(user);
        return llmClient.recommendMenus(request, inventory)
                .map(options -> new RecommendationResponse("menu_options", options))
                .orElseGet(() -> mockRecommendation(inventory, request.ingredients()));
    }

    private void saveGuidedAnswers(User user, RecommendationRequest request) {
        UserPreference preference = userPreferenceRepository.findByUserId(user.getId())
                .orElseGet(() -> new UserPreference(user));
        preference.updateGuidedAnswers(
                request.religiousAnswer().trim(),
                request.vegetarianAnswer().trim(),
                request.cuisineAnswer().trim()
        );
        userPreferenceRepository.save(preference);
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

    private void validate(RecommendationRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("recommendation request is required");
        }
        if (!StringUtils.hasText(request.religiousAnswer())) {
            throw new IllegalArgumentException("religiousAnswer is required");
        }
        if (!StringUtils.hasText(request.vegetarianAnswer())) {
            throw new IllegalArgumentException("vegetarianAnswer is required");
        }
        if (!StringUtils.hasText(request.cuisineAnswer())) {
            throw new IllegalArgumentException("cuisineAnswer is required");
        }
    }
}
