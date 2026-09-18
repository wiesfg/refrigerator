package com.refrigerator.backend.dto;

import java.util.List;

public record CookRequest(Long userId, List<CookIngredient> ingredients) {
}
