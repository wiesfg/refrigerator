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
import com.refrigerator.backend.repository.UserPreferenceRepository;

@SpringBootTest
@AutoConfigureMockMvc
class ChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserPreferenceRepository userPreferenceRepository;

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

    @Test
    void structuredRecommendationReturnsFourMenuOptions() throws Exception {
        String body = """
                {
                  "religiousAnswer": "돼지고기는 먹지 않아요.",
                  "vegetarianAnswer": "채식주의자는 아니에요.",
                  "cuisineAnswer": "매콤한 한식이 먹고 싶어요.",
                  "ingredients": ["계란", "두부", "김치"]
                }
                """;

        mockMvc.perform(post("/api/recommendations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message_type").value("menu_options"))
                .andExpect(jsonPath("$.options.length()").value(4))
                .andExpect(jsonPath("$.options[0].menu_name").isString())
                .andExpect(jsonPath("$.options[1].menu_name").isString())
                .andExpect(jsonPath("$.options[2].menu_name").isString())
                .andExpect(jsonPath("$.options[3].menu_name").isString());

        org.junit.jupiter.api.Assertions.assertTrue(userPreferenceRepository.findAll().stream()
                .anyMatch(preference -> "돼지고기는 먹지 않아요.".equals(preference.getReligiousRestriction())
                        && "채식주의자는 아니에요.".equals(preference.getVegetarianType())
                        && "매콤한 한식이 먹고 싶어요.".equals(preference.getPreferredCuisine())));
    }

    @Test
    void inventoryCanBeAddedAndListedForRecommendations() throws Exception {
        String item = """
                {
                  "name": "두부",
                  "amount": 1,
                  "unit": "모",
                  "location": "냉장",
                  "expiry": "2099-12-31"
                }
                """;

        mockMvc.perform(post("/api/inventory")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(item))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("두부"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/inventory"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("두부"));
    }
}
