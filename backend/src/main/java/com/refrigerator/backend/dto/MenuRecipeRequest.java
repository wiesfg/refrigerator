package com.refrigerator.backend.dto;

import java.util.List;

public record MenuRecipeRequest(Long userId, String menuName, List<String> ingredients, String message) {}
