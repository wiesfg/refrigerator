package com.refrigerator.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ChatResponse(
        Long userId,
        @JsonProperty("menu_name")
        String menuName,
        String reason,
        UserPreferenceResponse preference
) {
}
