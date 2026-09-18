# Refrigerator

냉장고 재고를 관리하고 보유 재료에 맞는 레시피를 찾는 해커톤 프로젝트입니다. 프런트엔드는 React/Vite, 백엔드는 Node.js 내장 HTTP 서버와 SQLite를 사용합니다.

## 로컬 실행

Node.js 24 이상이 필요합니다. 터미널 두 개에서 각각 실행하세요.

```bash
npm install
npm run server
```

```bash
npm run dev
```

Vite는 `/api` 요청을 `http://127.0.0.1:3001`의 백엔드로 전달합니다. 서버 상태는 `http://127.0.0.1:3001/api/health`에서 확인할 수 있습니다. SQLite 파일은 `server/data/refrigerator.sqlite`에 생성되며 Git에 올라가지 않습니다.

외부 API를 사용하려면 `server/.env.example`을 `server/.env`로 복사하고 키를 입력하세요. 실제 키는 Git에 커밋하지 마세요. 백엔드 API와 프런트엔드 연결 방법은 [server/README.md](server/README.md)에 있습니다.

```bash
npm run test:server
npm run lint
npm run build
```
