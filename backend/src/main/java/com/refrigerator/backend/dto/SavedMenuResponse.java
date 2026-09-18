package com.refrigerator.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.refrigerator.backend.domain.SavedMenu;
import java.time.LocalDateTime;

public record SavedMenuResponse(
        Long id,
        @JsonProperty("user_id") Long userId,
        @JsonProperty("menu_name") String menuName,
        @JsonProperty("saved_at") LocalDateTime savedAt
) {
    public static SavedMenuResponse from(SavedMenu menu) {
        return new SavedMenuResponse(menu.getId(), menu.getUser().getId(), menu.getMenuName(), menu.getSavedAt());
    }
}
