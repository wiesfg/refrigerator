package com.refrigerator.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void chatExtractsPreferenceAndReturnsMenuRecommendation() throws Exception {
        String body = """
                {
                  "message": "나는 다이어트 중이고 매운맛 좋아해. 계란, 토마토, 닭가슴살이 있어",
                  "ingredients": ["계란", "토마토", "닭가슴살"]
                }
                """;

        mockMvc.perform(post("/api/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.menu_name").value("토마토 계란 닭가슴살 볶음"))
                .andExpect(jsonPath("$.reason").isString())
                .andExpect(jsonPath("$.preference.diet_type").value("다이어트"))
                .andExpect(jsonPath("$.preference.preferred_taste").value("매운맛"));
    }
}
