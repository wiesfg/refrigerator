package com.refrigerator.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.refrigerator.backend.domain.UserPreference;

public record UserPreferenceResponse(
        @JsonProperty("diet_type")
        String dietType,
        String allergies,
        @JsonProperty("preferred_taste")
        String preferredTaste,
        @JsonProperty("disliked_ingredients")
        String dislikedIngredients,
        @JsonProperty("health_goal")
        String healthGoal
) {

    public static UserPreferenceResponse from(UserPreference preference) {
        return new UserPreferenceResponse(
                preference.getDietType(),
                preference.getAllergies(),
                preference.getPreferredTaste(),
                preference.getDislikedIngredients(),
                preference.getHealthGoal()
        );
    }
}
