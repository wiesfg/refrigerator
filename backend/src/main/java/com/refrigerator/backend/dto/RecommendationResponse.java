package com.refrigerator.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record RecommendationResponse(
        @JsonProperty("message_type")
        String messageType,
        List<MenuOption> options
) {
}
