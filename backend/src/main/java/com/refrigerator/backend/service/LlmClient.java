package com.refrigerator.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.refrigerator.backend.config.LlmProperties;
import com.refrigerator.backend.domain.UserPreference;
import com.refrigerator.backend.dto.MenuRecommendationResult;
import com.refrigerator.backend.dto.PreferenceExtractionResult;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class LlmClient {

    private final LlmProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public LlmClient(LlmProperties properties, ObjectMapper objectMapper, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder
                .baseUrl(properties.baseUrl())
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    public Optional<PreferenceExtractionResult> extractPreferences(String message) {
        if (!properties.hasApiKey()) {
            return Optional.empty();
        }

        String prompt = """
                Extract food preference facts from the user message.
                Return only valid JSON with these exact keys:
                dietType, allergies, preferredTaste, dislikedIngredients, healthGoal.
                Use null when a value is unknown.

                User message:
                %s
                """.formatted(message);

        return callChatCompletion(prompt)
                .flatMap((content) -> readJson(content, PreferenceExtractionResult.class));
    }

    public Optional<MenuRecommendationResult> recommendMenu(UserPreference preference, List<String> ingredients) {
        if (!properties.hasApiKey()) {
            return Optional.empty();
        }

        String prompt = """
                Recommend exactly one Korean-friendly menu using the user's saved preferences and current ingredients.
                Do not include cooking steps or recipe instructions.
                Return only valid JSON with these exact keys:
                menuName, reason.

                User preference:
                - dietType: %s
                - allergies: %s
                - preferredTaste: %s
                - dislikedIngredients: %s
                - healthGoal: %s

                Current ingredients:
                %s
                """.formatted(
                preference.getDietType(),
                preference.getAllergies(),
                preference.getPreferredTaste(),
                preference.getDislikedIngredients(),
                preference.getHealthGoal(),
                ingredients.isEmpty() ? "No explicit ingredients provided" : String.join(", ", ingredients)
        );

        return callChatCompletion(prompt)
                .flatMap((content) -> readJson(content, MenuRecommendationResult.class));
    }

    private Optional<String> callChatCompletion(String prompt) {
        try {
            ChatCompletionResponse response = restClient.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + properties.apiKey())
                    .body(new ChatCompletionRequest(
                            properties.model(),
                            List.of(
                                    new ChatMessage("system", "You are a menu recommendation assistant. Return JSON only."),
                                    new ChatMessage("user", prompt)
                            )
                    ))
                    .retrieve()
                    .body(ChatCompletionResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                return Optional.empty();
            }

            ChatMessage message = response.choices().get(0).message();
            return message == null ? Optional.empty() : Optional.ofNullable(message.content());
        } catch (RuntimeException exception) {
            return Optional.empty();
        }
    }

    private <T> Optional<T> readJson(String content, Class<T> type) {
        try {
            return Optional.of(objectMapper.readValue(extractJsonObject(content), type));
        } catch (JsonProcessingException exception) {
            return Optional.empty();
        }
    }

    private String extractJsonObject(String content) {
        String trimmed = content.trim();
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed;
    }

    private record ChatCompletionRequest(
            String model,
            List<ChatMessage> messages
    ) {
    }

    private record ChatCompletionResponse(
            List<ChatChoice> choices
    ) {
    }

    private record ChatChoice(
            ChatMessage message
    ) {
    }

    private record ChatMessage(
            String role,
            String content
    ) {
    }
}
