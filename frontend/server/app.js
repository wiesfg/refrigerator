import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  addItem, addRecipe, cookRecipe, getItem, getRecipe, listItems, listRecipes, updateItem,
} from './db.js';
import { analyzeReceipt, recommendRecipes, searchPublicRecipes } from './external.js';
import { InputError, itemInput, numericId, recipeInput } from './validation.js';

function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 8_000_000) throw new InputError('요청 본문이 너무 큽니다.', 413);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new InputError('올바른 JSON 본문이 필요합니다.');
  }
}

export function createApiServer({ db, env = process.env, fetchImpl = fetch }) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    const method = request.method;
    try {
      if (method === 'GET' && path === '/api/health') return send(response, 200, { ok: true });

      if (path === '/api/items') {
        if (method === 'GET') return send(response, 200, listItems(db));
        if (method === 'POST') return send(response, 201, addItem(db, itemInput(await readJson(request))));
      }

      if (path === '/api/items/bulk' && method === 'POST') {
        const body = await readJson(request);
        if (!Array.isArray(body) || body.length === 0 || body.length > 100) {
          throw new InputError('1~100개의 식재료 배열이 필요합니다.');
        }
        const items = body.map(itemInput);
        db.exec('BEGIN IMMEDIATE');
        try {
          const added = items.map((item) => addItem(db, item));
          db.exec('COMMIT');
          return send(response, 201, added);
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }

      const itemMatch = path.match(/^\/api\/items\/(\d+)$/);
      if (itemMatch) {
        const id = numericId(itemMatch[1]);
        const existing = getItem(db, id);
        if (!existing) throw new InputError('식재료를 찾을 수 없습니다.', 404);
        if (method === 'GET') return send(response, 200, existing);
        if (method === 'PATCH') {
          const patch = await readJson(request);
          return send(response, 200, updateItem(db, id, itemInput({ ...existing, ...patch })));
        }
        if (method === 'DELETE') {
          db.prepare('DELETE FROM items WHERE id = ?').run(id);
          response.writeHead(204);
          return response.end();
        }
      }

      if (path === '/api/recipes') {
        if (method === 'GET') return send(response, 200, listRecipes(db));
        if (method === 'POST') {
          const recipe = recipeInput(await readJson(request));
          if (db.prepare('SELECT id FROM recipes WHERE name = ?').get(recipe.name)) {
            throw new InputError('이미 저장된 레시피 이름입니다.', 409);
          }
          return send(response, 201, addRecipe(db, { ...recipe, id: randomUUID() }));
        }
      }

      if (path === '/api/recipes/search' && method === 'GET') {
        const recipes = await searchPublicRecipes(url.searchParams.get('q'), {
          apiKey: env.RECIPE_API_KEY, fetchImpl,
        });
        return send(response, 200, recipes);
      }

      const recipeMatch = path.match(/^\/api\/recipes\/([^/]+)$/);
      if (recipeMatch) {
        const id = decodeURIComponent(recipeMatch[1]);
        const recipe = getRecipe(db, id);
        if (!recipe) throw new InputError('레시피를 찾을 수 없습니다.', 404);
        if (method === 'GET') return send(response, 200, recipe);
        if (method === 'DELETE') {
          db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
          response.writeHead(204);
          return response.end();
        }
      }

      const cookMatch = path.match(/^\/api\/recipes\/([^/]+)\/cook$/);
      if (cookMatch && method === 'POST') {
        const recipe = getRecipe(db, decodeURIComponent(cookMatch[1]));
        if (!recipe) throw new InputError('레시피를 찾을 수 없습니다.', 404);
        const result = cookRecipe(db, recipe);
        return result.ok ? send(response, 200, result) : send(response, 409, result);
      }

      if (path === '/api/ai/receipt' && method === 'POST') {
        const items = await analyzeReceipt(await readJson(request), {
          apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetchImpl,
        });
        return send(response, 200, items);
      }

      if (path === '/api/ai/recommendations' && method === 'POST') {
        const recipes = await recommendRecipes(listItems(db), {
          apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetchImpl,
        });
        return send(response, 200, recipes);
      }

      return send(response, 404, { error: '경로를 찾을 수 없습니다.' });
    } catch (error) {
      if (error instanceof InputError) return send(response, error.status, { error: error.message });
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return send(response, 504, { error: '외부 API 응답 시간이 초과되었습니다.' });
      }
      console.error('API error:', error);
      return send(response, 500, { error: '서버 오류가 발생했습니다.' });
    }
  });
}
