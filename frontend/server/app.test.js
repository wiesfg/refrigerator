import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApiServer } from './app.js';
import { openDatabase } from './db.js';

const db = openDatabase(':memory:');
const calls = [];
const fetchImpl = async (url, options) => {
  calls.push({ url, options });
  if (url.includes('factchat-cloud.mindlogic.ai')) {
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify([
      { name: '우유', amount: 1, unit: '개', location: '냉장', expiry: '2026-09-22' },
    ]) } }] }), { status: 200 });
  }
  if (url.includes('generativelanguage.googleapis.com')) {
    const isReceipt = JSON.stringify(options.body).includes('inline_data');
    const result = isReceipt
      ? [{ name: '우유', amount: 1, unit: '개', location: '냉장', expiry: '2026-09-22' }]
      : [{ name: '계란국', description: '간단한 요리', calorie: '100 kcal', ingredients: [{ name: '계란', amount: 1, unit: '개' }], manual: ['물을 끓인다', '계란을 넣는다'] }];
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }), { status: 200 });
  }
  return new Response(JSON.stringify({ COOKRCP01: { row: [{ RCP_SEQ: '1', RCP_NM: '계란국', RCP_PARTS_DTLS: '계란 2개, 양파 1/2개', MANUAL01: '1. 끓인다' }] } }), { status: 200 });
};
const server = createApiServer({
  db,
  env: { JBNU_LLM_API_KEY: 'test-key', GEMINI_API_KEY: 'test-key', RECIPE_API_KEY: 'test-key' },
  fetchImpl,
});
let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

async function request(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

test('inventory CRUD and invalid dates', async () => {
  assert.equal((await request('/api/health')).body.ok, true);
  const item = { name: '계란', amount: 3, unit: '개', location: '냉장', expiry: '2026-09-30' };
  const created = await request('/api/items', 'POST', item);
  assert.equal(created.status, 201);
  assert.equal((await request('/api/items')).body[0].name, '계란');
  const id = created.body.id;
  assert.equal((await request(`/api/items/${id}`, 'PATCH', { amount: 4 })).body.amount, 4);
  assert.equal((await request('/api/items', 'POST', { ...item, expiry: '2026-02-30' })).status, 400);
  assert.equal((await request(`/api/items/${id}`, 'DELETE')).status, 204);
  assert.equal((await request('/api/items')).body.length, 0);
});

test('bulk receipt import and cooking deduct earliest batches atomically', async () => {
  const items = [
    { name: '계란', amount: 1, unit: '개', location: '냉장', expiry: '2026-09-20' },
    { name: '계란', amount: 2, unit: '개', location: '냉장', expiry: '2026-09-25' },
  ];
  assert.equal((await request('/api/items/bulk', 'POST', items)).body.length, 2);
  const recipe = await request('/api/recipes', 'POST', {
    name: '계란국', ingredients: [{ name: '계란', amount: 2, unit: '개' }], manual: ['끓인다'],
  });
  assert.equal(recipe.status, 201);
  const id = recipe.body.id;
  assert.equal((await request(`/api/recipes/${id}/cook`, 'POST')).status, 200);
  const stock = (await request('/api/items')).body;
  assert.equal(stock.length, 1);
  assert.equal(stock[0].amount, 1);
  assert.equal(stock[0].expiry, '2026-09-25');
  assert.equal((await request(`/api/recipes/${id}/cook`, 'POST')).status, 409);
  assert.deepEqual((await request('/api/items')).body, stock);
});

test('AI and public data adapters preserve frontend field shapes without exposing keys', async () => {
  const scanned = await request('/api/ai/receipt', 'POST', { imageBase64: 'YWJj', mimeType: 'image/png' });
  assert.equal(scanned.status, 200);
  assert.equal(scanned.body[0].name, '우유');
  const suggestions = await request('/api/ai/recommendations', 'POST');
  assert.equal(suggestions.status, 200);
  assert.equal(suggestions.body[0].ingredients[0].name, '계란');
  assert.equal(suggestions.body[0].matchRate, 100);
  assert.equal(suggestions.body[0].canCook, true);
  const publicRecipes = await request('/api/recipes/search?q=계란국');
  assert.equal(publicRecipes.status, 200);
  assert.equal(publicRecipes.body[0].ingredients[1].amount, 0.5);
  assert.ok(calls.some(({ options }) => options?.headers?.Authorization === 'Bearer test-key'));
  assert.ok(!JSON.stringify(scanned.body).includes('test-key'));
});
