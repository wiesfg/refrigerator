package com.refrigerator.backend.dto;

import java.util.List;

/**
 * The three answers collected by the guided chat flow.
 *
 * The answers stay as text at the API boundary. A later service step will
 * normalize them before sending a prompt to the LLM.
 */
public record RecommendationRequest(
        Long userId,
        String religiousAnswer,
        String vegetarianAnswer,
        String cuisineAnswer,
        List<String> ingredients
) {
}
