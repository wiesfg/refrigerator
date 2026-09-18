package com.refrigerator.backend.service;

import com.refrigerator.backend.dto.MenuOption;
import com.refrigerator.backend.dto.RecommendationRequest;
import com.refrigerator.backend.dto.RecommendationResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RecommendationService {

    public RecommendationResponse recommend(RecommendationRequest request) {
        validate(request);

        // TODO: Replace this mock result with inventory lookup and LLM call.
        return new RecommendationResponse(
                "menu_options",
                List.of(
                        new MenuOption("김치볶음밥"),
                        new MenuOption("두부 된장찌개"),
                        new MenuOption("계란 채소볶음"),
                        new MenuOption("닭가슴살 덮밥")
                )
        );
    }

    private void validate(RecommendationRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("recommendation request is required");
        }
        if (!StringUtils.hasText(request.religiousAnswer())) {
            throw new IllegalArgumentException("religiousAnswer is required");
        }
        if (!StringUtils.hasText(request.vegetarianAnswer())) {
            throw new IllegalArgumentException("vegetarianAnswer is required");
        }
        if (!StringUtils.hasText(request.cuisineAnswer())) {
            throw new IllegalArgumentException("cuisineAnswer is required");
        }
    }
}
