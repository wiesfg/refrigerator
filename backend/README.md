# Refrigerator Backend

Spring Boot backend for the Refrigerator menu recommendation service.

## Run

```bash
cd backend
mvn spring-boot:run
```

## Development Database

This project uses an in-memory H2 database for early development.

- Health check: `GET http://localhost:8080/api/health`
- H2 console: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:refrigerator`
- Username: `sa`
- Password: empty

## Current Scope

- Spring Boot application setup
- Spring Data JPA
- H2 database
- `User` entity
- `UserPreference` entity with a one-to-one user mapping
- Mock chat flow through `POST /api/chat`

## Chat API

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "userId": 1,
  "message": "나는 다이어트 중이고 매운맛 좋아해. 계란, 토마토, 닭가슴살이 있어",
  "ingredients": ["계란", "토마토", "닭가슴살"]
}
```

```json
{
  "userId": 1,
  "menu_name": "토마토 계란 닭가슴살 볶음",
  "reason": "계란, 토마토, 닭가슴살를 활용해 단백질을 챙기면서 부담이 적은 메뉴입니다.",
  "preference": {
    "diet_type": "다이어트",
    "allergies": null,
    "preferred_taste": "매운맛",
    "disliked_ingredients": null,
    "health_goal": "고단백"
  }
}
```

If `JBNU_LLM_API_KEY` is not set, the app falls back to local mock recommendations.

## Guided menu conversation

The React chat asks three questions, then calls `POST /api/recommendations`
with `religiousAnswer`, `vegetarianAnswer`, `cuisineAnswer`, and `ingredients`.
Keep the returned `user_id` for subsequent requests.

For another set of four menus, send the same answers and `userId`, plus:

```json
{
  "message": "다른 메뉴 4개 추천해줘. 이번에는 국물 요리로",
  "excludedMenus": ["두부구이", "채소비빔밥", "버섯볶음", "양파국"]
}
```

`excludedMenus` contains all menus shown earlier in the conversation. The backend
rejects duplicate or previously suggested names and retries the LLM once.

After selecting one menu, the frontend saves it with `POST /api/saved-menus`,
then requests a detailed recipe:

```http
POST /api/recommendations/recipe
Content-Type: application/json
```

```json
{
  "userId": 1,
  "menuName": "두부구이",
  "ingredients": ["두부", "양파"],
  "message": "간단한 요리로 부탁해"
}
```

The response contains `menu_name` and `steps` (10–15 detailed Korean instructions).
Each step is displayed as a separate numbered list item. The prompt covers ingredient
quantities, preparation, heat levels, approximate cooking times and signs of doneness.
Recipe generation uses the saved dietary restrictions and current ingredients.
It requires the Spring Boot process to have `JBNU_LLM_API_KEY` configured;
the scan server's environment settings do not configure Spring Boot automatically.
Recipes and follow-up recommendations never fall back to mock results on failure.
If recipe generation fails after saving, the menu remains saved and the user can
retry the same selection. The chat input remains available after each selection.

## JBNU LLM Setup

The backend calls an OpenAI-compatible chat completions API. Keep the API key in an environment variable, not in source code.

```bash
export JBNU_LLM_BASE_URL="https://factchat-cloud.mindlogic.ai/v1/gateway"
export JBNU_LLM_MODEL="claude-sonnet-5"
export JBNU_LLM_API_KEY="your-api-key"

mvn spring-boot:run
```
