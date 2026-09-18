package com.refrigerator.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record MenuRecipeResponse(@JsonProperty("menu_name") String menuName, List<String> steps) {}
