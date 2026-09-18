package com.refrigerator.backend.dto;

public record SavedMenuRequest(
        Long userId,
        String menuName
) {
}
