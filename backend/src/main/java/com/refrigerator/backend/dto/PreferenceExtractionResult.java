package com.refrigerator.backend.dto;

public record PreferenceExtractionResult(
        String dietType,
        String allergies,
        String preferredTaste,
        String dislikedIngredients,
        String healthGoal
) {
}
