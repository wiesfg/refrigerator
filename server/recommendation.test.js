import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommendRecipes } from './external.js';

function dateOffset(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

test('recommendations exclude expired stock and check real quantities and missing ingredients', async () => {
  const items = [
    { name: '계란', amount: 1, unit: '개', expiry: dateOffset(1) },
    { name: '계란', amount: 1, unit: '개', expiry: dateOffset(8) },
    { name: '우유', amount: 200, unit: 'ml', expiry: dateOffset(-2) },
  ];
  const generated = [
    { name: '계란찜', description: '임박한 계란 활용', calorie: '100 kcal', ingredients: [{ name: '계란', amount: 2, unit: '개' }], manual: ['계란을 푼다', '찐다'] },
    { name: '계란말이', description: '추가 재료 필요', calorie: '150 kcal', ingredients: [{ name: '계란', amount: 3, unit: '개' }, { name: '대파', amount: 1, unit: '개' }], manual: ['섞는다', '굽는다'] },
    { name: '우유죽', description: '만료된 우유', calorie: '200 kcal', ingredients: [{ name: '우유', amount: 100, unit: 'ml' }], manual: ['끓인다', '식힌다'] },
  ];
  let request;
  const fetchImpl = async (_url, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }), { status: 200 });
  };
  const result = await recommendRecipes(items, { apiKey: 'test-key', fetchImpl });
  assert.equal(result.length, 2);
  assert.equal(result[0].name, '계란찜');
  assert.equal(result[0].matchRate, 100);
  assert.equal(result[0].canCook, true);
  assert.deepEqual(result[0].expiringIngredients, ['계란']);
  assert.deepEqual(result[1].missingIngredients, [
    { name: '계란', amount: 1, unit: '개' },
    { name: '대파', amount: 1, unit: '개' },
  ]);
  assert.equal(result[1].canCook, false);
  assert.ok(request.generationConfig.responseFormat.text.schema);
  assert.ok(!request.contents[0].parts[0].text.includes('우유'));
});

test('recommendations refuse expired-only inventory before calling the model', async () => {
  await assert.rejects(
    recommendRecipes([{ name: '우유', amount: 1, unit: '개', expiry: dateOffset(-2) }], {
      apiKey: 'test-key', fetchImpl: () => { throw new Error('should not be called'); },
    }),
    { status: 409 },
  );
});
