package com.refrigerator.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.refrigerator.backend.config.LlmProperties;
import com.refrigerator.backend.domain.User;
import com.refrigerator.backend.domain.UserPreference;
import com.refrigerator.backend.dto.*;
import com.refrigerator.backend.repository.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.hamcrest.Matchers.containsString;

class MenuConversationTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private MockRestServiceServer remote;
    private LlmClient llm;
    private RecommendationService service;

    @BeforeEach
    void setup() {
        var builder = RestClient.builder();
        remote = MockRestServiceServer.bindTo(builder).build();
        llm = new LlmClient(new LlmProperties("https://example.test/v1/gateway", "test-key", "test-model"), mapper, builder);
        var users = mock(UserRepository.class);
        var preferences = mock(UserPreferenceRepository.class);
        var inventory = mock(InventoryItemRepository.class);
        var user = mock(User.class);
        when(user.getId()).thenReturn(1L);
        when(users.findById(1L)).thenReturn(Optional.of(user));
        var preference = new UserPreference(user);
        preference.updateGuidedAnswers("돼지고기 제외", "비건", "한식");
        when(preferences.findByUserId(1L)).thenReturn(Optional.of(preference));
        when(inventory.findByUserIdAndExpiryGreaterThanEqualOrderByExpiryAsc(eq(1L), any())).thenReturn(List.of());
        service = new RecommendationService(inventory, users, preferences, llm);
    }

    private void reply(String content, String... expectedPromptParts) throws Exception {
        var expectation = remote.expect(requestTo("https://example.test/v1/gateway/chat/completions"))
                .andExpect(header("Authorization", "Bearer test-key"));
        for (var part : expectedPromptParts) expectation.andExpect(content().string(containsString(part)));
        expectation.andRespond(withSuccess(mapper.writeValueAsString(Map.of("choices", List.of(
                Map.of("message", Map.of("content", content))))), MediaType.APPLICATION_JSON));
    }

    @Test
    void followUpUsesSavedRestrictionsAndRetriesRepeatedMenus() throws Exception {
        reply("[{\"menu_name\":\"두부 구이\"},{\"menu_name\":\"버섯국\"},{\"menu_name\":\"채소죽\"},{\"menu_name\":\"비빔밥\"}]");
        reply("[{\"menu_name\":\"두부조림\"},{\"menu_name\":\"버섯국\"},{\"menu_name\":\"채소죽\"},{\"menu_name\":\"비빔밥\"}]",
                "돼지고기 제외", "비건", "국물 요리", "두부구이");
        var result = service.recommend(new RecommendationRequest(1L, null, null, null,
                List.of("두부"), "국물 요리로 다른 메뉴 추천", List.of("두부구이")));
        assertEquals(4, result.options().size());
        assertEquals("두부조림", result.options().get(0).menuName());
        remote.verify();
    }

    @Test
    void repeatedOrDuplicateMenusNeverFallBackToOldMockMenus() throws Exception {
        var duplicates = "[{\"menu_name\":\"두부국\"},{\"menu_name\":\"두부 국\"},{\"menu_name\":\"채소죽\"},{\"menu_name\":\"비빔밥\"}]";
        reply(duplicates);
        reply(duplicates);
        var error = assertThrows(ResponseStatusException.class, () -> service.recommend(
                new RecommendationRequest(1L, null, null, null, List.of("두부"), "다른 메뉴", List.of("두부구이"))));
        assertEquals(502, error.getStatusCode().value());
        remote.verify();
    }

    @Test
    void recipeCarriesSelectedMenuAndDietaryContext() throws Exception {
        var steps = List.of("1인분 기준 두부 반 모를 준비해요.", "양파 반 개를 준비해요.",
                "두부의 물기를 닦아요.", "두부를 1cm 두께로 썰어요.", "양파를 얇게 썰어요.",
                "간장 1큰술과 물 4큰술을 섞어요.", "팬을 중불로 달궈요.", "두부를 앞뒤로 2분씩 구워요.",
                "양파와 양념을 넣고 약불로 5분 조려요.", "양파가 부드러워지면 간을 확인하고 접시에 담아요.");
        reply(mapper.writeValueAsString(Map.of("steps", steps)),
                "두부조림", "비건", "돼지고기 제외", "덜 맵게", "10 to 15", "heat level");
        var recipe = service.recipe(new MenuRecipeRequest(1L, "두부조림", List.of("두부"), "덜 맵게"));
        assertEquals("두부조림", recipe.menuName());
        assertEquals(steps, recipe.steps());
        remote.verify();
    }

    @Test
    void invalidRecipeIsReportedAsFailure() throws Exception {
        reply(mapper.writeValueAsString(Map.of("steps", java.util.Collections.nCopies(9, "두부를 썰어요."))));
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> service.recipe(
                new MenuRecipeRequest(1L, "두부조림", List.of("두부"), null))).getStatusCode().value());
        remote.verify();
    }

    @Test
    void remoteFailureDoesNotReturnFakeRecipe() {
        remote.expect(requestTo("https://example.test/v1/gateway/chat/completions")).andRespond(withServerError());
        assertThrows(ResponseStatusException.class, () -> service.recipe(
                new MenuRecipeRequest(1L, "두부조림", List.of("두부"), null)));
        remote.verify();
    }
}
