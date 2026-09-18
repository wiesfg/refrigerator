# 백엔드 API와 프런트엔드 연결

`feat/frontend` 브랜치의 재고 `{ id, name, amount, unit, location, expiry }`와 레시피 `{ id, name, description, calorie, imageUrl, ingredients, manual }` 형식을 기준으로 만들었습니다. **현재 브랜치의 `src/App.jsx`는 여전히 `localStorage`를 사용합니다.** 프런트엔드 작업자가 아래 API로 호출을 교체해야 서버 데이터가 화면에 반영됩니다.

## 실행과 키 설정

Node.js 24 이상에서 저장소 루트의 `npm run server`를 실행하세요. 기본 주소는 `http://127.0.0.1:3001`입니다. `server/.env.example`을 `server/.env`로 복사해 `GEMINI_API_KEY`와 `RECIPE_API_KEY`를 넣으면 외부 API가 활성화됩니다. 키가 없어도 재고와 저장 레시피 API는 동작합니다.

기존 `feat/frontend`의 `VITE_GEMINI_API_KEY`와 `VITE_RECIPE_API_KEY` 사용은 제거해야 합니다. `VITE_` 변수는 브라우저 번들에 포함되므로 비밀 키 저장에 적합하지 않습니다. 이전에 커밋된 `.env`의 키는 폐기하고 새 키를 서버에만 설정해야 합니다.

## API

응답은 표에 적힌 배열 또는 객체를 JSON으로 직접 반환합니다. 오류는 `{ "error": "메시지" }` 형식입니다.

| 동작 | 요청 | 응답 |
| --- | --- | --- |
| 서버 확인 | `GET /api/health` | `{ "ok": true }` |
| 재고 목록 | `GET /api/items` | 식재료 배열 |
| 재고 등록 | `POST /api/items` | 등록된 식재료 |
| 영수증 검토 후 일괄 등록 | `POST /api/items/bulk` | 등록된 식재료 배열 |
| 재고 한 건 조회 | `GET /api/items/:id` | 식재료 |
| 재고 일부 수정 | `PATCH /api/items/:id` | 수정된 식재료 |
| 재고 삭제 | `DELETE /api/items/:id` | 내용 없음, HTTP 204 |
| 저장 레시피 목록 | `GET /api/recipes` | 레시피 배열 |
| 레시피 저장 | `POST /api/recipes` | 저장된 레시피 |
| 레시피 조회/삭제 | `GET`, `DELETE /api/recipes/:id` | 레시피 또는 HTTP 204 |
| 요리 완료 | `POST /api/recipes/:id/cook` | `{ "ok": true, "items": [...] }` |
| 공공 레시피 검색 | `GET /api/recipes/search?q=된장찌개` | 레시피 배열 |
| 영수증 AI 분석 | `POST /api/ai/receipt` | 식재료 배열 (DB 저장 전 검토용) |
| 재고 기반 AI 추천 | `POST /api/ai/recommendations` | 레시피 배열 (DB 저장 전 검토용) |

### 핵심 기능: 내 재료로 메뉴 추천

재고를 등록한 다음 `POST /api/ai/recommendations`를 호출하면 서버가 **저장된 재고를 직접 조회**해 Gemini에 전달합니다. 요청 본문은 필요하지 않습니다. 서버는 소비기한이 지난 재료를 제외하고, 임박한 재료와 실제 보유 수량을 알려줍니다. 모델 결과는 서버가 다시 재고와 대조하며, 보유 재료를 하나도 쓰지 않는 메뉴는 제외합니다.

각 추천 레시피에는 프런트엔드에서 쓰던 `name`, `description`, `calorie`, `ingredients`, `manual`에 다음 필드가 추가됩니다.

```json
{
  "matchRate": 75,
  "canCook": false,
  "missingIngredients": [{ "name": "계란", "amount": 1, "unit": "개" }],
  "expiringIngredients": ["두부"]
}
```

`matchRate`는 **요리 재료별 필요한 수량 대비 보유 수량의 비율을 평균한 값**입니다. 재료명과 단위가 모두 일치해야 보유한 것으로 계산합니다. `canCook`은 모든 재료의 필요 수량을 충족할 때만 `true`입니다. 조리 버튼을 누를 때도 최신 재고로 다시 확인합니다. 추천 메뉴의 칼로리와 조리법은 AI가 생성한 참고 정보이므로 확인 후 저장하세요.

재고 등록 예시:

```json
{
  "name": "계란",
  "amount": 6,
  "unit": "개",
  "location": "냉장",
  "expiry": "2026-09-30"
}
```

일괄 등록은 위 객체의 배열을 보냅니다. `id`는 서버가 만듭니다. 단위는 `개`, `g`, `ml`, `모`, `봉지`, `줄기`, `대`, `토막`, `쪽`을 허용합니다. 보관 위치는 `냉장`, `냉동`, `실온` 중 하나입니다. 수량은 양수여야 합니다.

레시피 저장 예시:

```json
{
  "name": "계란국",
  "calorie": "100 kcal",
  "ingredients": [{ "name": "계란", "amount": 2, "unit": "개" }],
  "manual": ["물을 끓입니다.", "계란을 넣습니다."]
}
```

요리 완료는 **이름과 단위가 일치하는 재고**에서 필요한 수량을 차감합니다. 여러 묶음이 있으면 소비기한이 빠른 것부터 사용합니다. 재고가 부족하면 HTTP 409와 `{ "ok": false, "missing": [...] }`를 반환하며 아무것도 차감하지 않습니다. 이 동작은 기존 프런트엔드의 이름만 보고 차감하던 방식보다 엄격합니다.

영수증 분석에는 다음 JSON을 보냅니다. `imageBase64`는 `data:image/...;base64,` 접두부를 제거한 이미지 데이터입니다.

```json
{ "imageBase64": "...", "mimeType": "image/jpeg" }
```

## `feat/frontend` 연결 순서

1. `localStorage`의 식재료 초기값 대신 `GET /api/items`를 호출합니다. 기존 브라우저 데이터를 옮기려면 사용자가 확인한 뒤 `POST /api/items/bulk`를 한 번 호출하세요. 무조건 자동 이관하면 중복 등록될 수 있습니다.
2. 재료 추가·수정·삭제 버튼을 각각 `POST`, `PATCH`, `DELETE /api/items`로 연결합니다.
3. 레시피 목록·저장을 `GET`, `POST /api/recipes`로 연결하고 요리 완료는 `POST /api/recipes/:id/cook`을 호출합니다.
4. Gemini 직접 호출을 `POST /api/ai/receipt`, `POST /api/ai/recommendations`로 바꿉니다. 추천 카드에 `canCook`, `missingIngredients`, `expiringIngredients`를 표시하고, 기존의 이름만 비교한 매칭률 대신 서버의 `matchRate`를 사용합니다. 공공데이터 직접 호출은 `GET /api/recipes/search?q=...`로 바꿉니다.

Vite 개발 서버에서는 `/api/...`처럼 상대 경로를 사용하면 됩니다. 배포할 때는 프런트엔드 서버의 `/api`를 백엔드에 연결해야 합니다.

현재 구현은 **로그인 없는 단일 시연용 재고**를 공유합니다. 여러 사용자의 데이터를 분리하거나 인터넷에 공개 배포하려면 인증과 사용자별 데이터 구분을 추가해야 합니다.
