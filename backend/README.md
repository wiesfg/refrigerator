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

The LLM calls are currently mocked inside `ChatService`. Replace the methods marked with `TODO: LLM 호출` when connecting a real model.
