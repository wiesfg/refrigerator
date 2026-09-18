package com.refrigerator.backend.service;

import com.refrigerator.backend.domain.User;
import com.refrigerator.backend.domain.UserPreference;
import com.refrigerator.backend.dto.ChatRequest;
import com.refrigerator.backend.dto.ChatResponse;
import com.refrigerator.backend.dto.MenuRecommendationResult;
import com.refrigerator.backend.dto.PreferenceExtractionResult;
import com.refrigerator.backend.dto.UserPreferenceResponse;
import com.refrigerator.backend.repository.UserPreferenceRepository;
import com.refrigerator.backend.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ChatService {

    private static final String DEFAULT_NICKNAME = "demo-user";

    private final UserRepository userRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final LlmClient llmClient;

    public ChatService(
            UserRepository userRepository,
            UserPreferenceRepository userPreferenceRepository,
            LlmClient llmClient
    ) {
        this.userRepository = userRepository;
        this.userPreferenceRepository = userPreferenceRepository;
        this.llmClient = llmClient;
    }

    @Transactional
    public ChatResponse recommendMenu(ChatRequest request) {
        String message = normalizeMessage(request.message());
        User user = findOrCreateUser(request.userId());
        UserPreference preference = findOrCreatePreference(user);

        PreferenceExtractionResult extractedPreference = extractPreferencesWithLlm(message);
        preference.updatePreferences(
                chooseNewValue(extractedPreference.dietType(), preference.getDietType()),
                chooseNewValue(extractedPreference.allergies(), preference.getAllergies()),
                chooseNewValue(extractedPreference.preferredTaste(), preference.getPreferredTaste()),
                chooseNewValue(extractedPreference.dislikedIngredients(), preference.getDislikedIngredients()),
                chooseNewValue(extractedPreference.healthGoal(), preference.getHealthGoal())
        );
        userPreferenceRepository.save(preference);

        List<String> ingredients = extractIngredients(message, request.ingredients());
        MenuRecommendationResult recommendation = recommendMenuWithLlm(preference, ingredients);

        return new ChatResponse(
                user.getId(),
                recommendation.menuName(),
                recommendation.reason(),
                UserPreferenceResponse.from(preference)
        );
    }

    private String normalizeMessage(String message) {
        if (!StringUtils.hasText(message)) {
            throw new IllegalArgumentException("message is required");
        }
        return message.trim();
    }

    private User findOrCreateUser(Long userId) {
        if (userId != null) {
            return userRepository.findById(userId)
                    .orElseGet(() -> userRepository.save(new User(DEFAULT_NICKNAME)));
        }
        return userRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> userRepository.save(new User(DEFAULT_NICKNAME)));
    }

    private UserPreference findOrCreatePreference(User user) {
        return userPreferenceRepository.findByUserId(user.getId())
                .orElseGet(() -> new UserPreference(user));
    }

    private PreferenceExtractionResult extractPreferencesWithLlm(String message) {
        return llmClient.extractPreferences(message)
                .orElseGet(() -> extractPreferencesWithMock(message));
    }

    private PreferenceExtractionResult extractPreferencesWithMock(String message) {
        String lowerMessage = message.toLowerCase(Locale.ROOT);

        String dietType = containsAny(lowerMessage, "다이어트", "저칼로리", "살빼", "diet")
                ? "다이어트"
                : null;
        String allergies = containsAny(lowerMessage, "새우", "shrimp")
                ? "새우"
                : null;
        String preferredTaste = containsAny(lowerMessage, "매운", "매콤", "spicy")
                ? "매운맛"
                : null;
        String dislikedIngredients = containsAny(lowerMessage, "오이 싫", "오이는 싫", "cucumber")
                ? "오이"
                : null;
        String healthGoal = containsAny(lowerMessage, "단백질", "protein")
                ? "고단백"
                : dietType;

        return new PreferenceExtractionResult(
                dietType,
                allergies,
                preferredTaste,
                dislikedIngredients,
                healthGoal
        );
    }

    private MenuRecommendationResult recommendMenuWithLlm(UserPreference preference, List<String> ingredients) {
        return llmClient.recommendMenu(preference, ingredients)
                .orElseGet(() -> recommendMenuWithMock(preference, ingredients));
    }

    private MenuRecommendationResult recommendMenuWithMock(UserPreference preference, List<String> ingredients) {
        String joinedIngredients = ingredients.isEmpty() ? "현재 입력한 재료" : String.join(", ", ingredients);

        if ("다이어트".equals(preference.getDietType()) || "고단백".equals(preference.getHealthGoal())) {
            return new MenuRecommendationResult(
                    "토마토 계란 닭가슴살 볶음",
                    joinedIngredients + "를 활용해 단백질을 챙기면서 부담이 적은 메뉴입니다."
            );
        }

        if ("매운맛".equals(preference.getPreferredTaste())) {
            return new MenuRecommendationResult(
                    "매콤 김치 두부 볶음",
                    joinedIngredients + "를 사용하고 선호하는 매운맛을 반영한 메뉴입니다."
            );
        }

        return new MenuRecommendationResult(
                "냉장고 재료 볶음밥",
                joinedIngredients + "를 한 번에 소진하기 좋은 간단한 메뉴입니다."
        );
    }

    private List<String> extractIngredients(String message, List<String> requestedIngredients) {
        List<String> ingredients = new ArrayList<>();
        if (requestedIngredients != null) {
            ingredients.addAll(requestedIngredients.stream()
                    .filter(StringUtils::hasText)
                    .map(String::trim)
                    .toList());
        }

        String lowerMessage = message.toLowerCase(Locale.ROOT);
        addIfMentioned(ingredients, lowerMessage, "계란", "계란", "달걀", "egg");
        addIfMentioned(ingredients, lowerMessage, "토마토", "토마토", "tomato");
        addIfMentioned(ingredients, lowerMessage, "닭가슴살", "닭가슴살", "chicken");
        addIfMentioned(ingredients, lowerMessage, "두부", "두부", "tofu");
        addIfMentioned(ingredients, lowerMessage, "김치", "김치", "kimchi");
        addIfMentioned(ingredients, lowerMessage, "밥", "밥", "rice");

        return ingredients.stream().distinct().toList();
    }

    private void addIfMentioned(List<String> ingredients, String message, String ingredient, String... keywords) {
        if (containsAny(message, keywords)) {
            ingredients.add(ingredient);
        }
    }

    private boolean containsAny(String message, String... keywords) {
        for (String keyword : keywords) {
            if (message.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String chooseNewValue(String newValue, String currentValue) {
        return StringUtils.hasText(newValue) ? newValue : currentValue;
    }
}
