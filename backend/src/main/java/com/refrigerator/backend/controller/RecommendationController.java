package com.refrigerator.backend.controller;

import com.refrigerator.backend.dto.RecommendationRequest;
import com.refrigerator.backend.dto.RecommendationResponse;
import com.refrigerator.backend.service.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @PostMapping
    public ResponseEntity<RecommendationResponse> recommend(
            @RequestBody RecommendationRequest request
    ) {
        return ResponseEntity.ok(recommendationService.recommend(request));
    }
}
