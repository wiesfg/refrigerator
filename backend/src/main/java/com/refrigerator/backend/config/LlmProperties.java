package com.refrigerator.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "llm")
public record LlmProperties(
        String baseUrl,
        String apiKey,
        String model
) {
    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
