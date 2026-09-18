package com.refrigerator.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MenuOption(
        @JsonProperty("menu_name")
        String menuName
) {
}
