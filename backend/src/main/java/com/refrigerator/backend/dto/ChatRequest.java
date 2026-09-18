package com.refrigerator.backend.dto;

import java.util.List;

public record ChatRequest(
        Long userId,
        String message,
        List<String> ingredients
) {
}
