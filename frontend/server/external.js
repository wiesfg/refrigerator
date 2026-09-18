import { InputError, itemInput, recipeInput } from './validation.js';

function parseModelJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new InputError('AI 응답을 JSON으로 해석할 수 없습니다.', 502);
  }
}

async function gemini(prompt, image, { apiKey, model = 'gemini-3.6-flash', fetchImpl = fetch, schema }) {
  if (!apiKey) throw new InputError('서버에 GEMINI_API_KEY가 설정되지 않았습니다.', 503);
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: schema
          ? { responseFormat: { text: { mimeType: 'application/json', schema } } }
          : { responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new InputError(`Gemini 요청이 실패했습니다. (${response.status})`, 502);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!text) throw new InputError('Gemini가 응답 내용을 반환하지 않았습니다.', 502);
  return parseModelJson(text);
}

export async function analyzeReceipt({ imageBase64, mimeType }, options) {
  if (typeof imageBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64) || imageBase64.length > 7_000_000) {
    throw new InputError('7MB 이하의 Base64 이미지가 필요합니다.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mimeType)) {
    throw new InputError('지원하지 않는 이미지 형식입니다.');
  }
  const today = new Date().toISOString().slice(0, 10);
  const result = await gemini(
    `마트 영수증에서 구매한 식재료만 추출하세요. 잡화와 결제정보는 제외하세요. 오늘은 ${today}입니다. 소비기한은 추정치입니다. JSON 배열로만 응답하세요. 각 항목은 name, amount(숫자), unit(개/g/ml/모/봉지), location(냉장/냉동/실온), expiry(YYYY-MM-DD)를 포함합니다.`,
    { base64: imageBase64, mimeType }, options,
  );
  if (!Array.isArray(result)) throw new InputError('AI 영수증 분석 결과 형식이 올바르지 않습니다.', 502);
  try {
    return result.map(itemInput);
  } catch {
    throw new InputError('AI 영수증 분석 결과의 식재료 형식이 올바르지 않습니다.', 502);
  }
}

const RECOMMENDATION_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      calorie: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'number' },
            unit: { type: 'string' },
          },
          required: ['name', 'amount', 'unit'],
        },
      },
      manual: { type: 'array', items: { type: 'string' } },
    },
    required: ['name', 'description', 'calorie', 'ingredients', 'manual'],
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(expiry, today) {
  return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

function measureRecipe(recipe, inventory, today) {
  const stock = new Map();
  for (const item of inventory) {
    const key = `${item.name}\0${item.unit}`;
    const existing = stock.get(key) ?? { amount: 0, earliestExpiry: item.expiry };
    existing.amount += item.amount;
    if (item.expiry < existing.earliestExpiry) existing.earliestExpiry = item.expiry;
    stock.set(key, existing);
  }

  const required = new Map();
  for (const ingredient of recipe.ingredients) {
    const key = `${ingredient.name}\0${ingredient.unit}`;
    required.set(key, (required.get(key) ?? 0) + ingredient.amount);
  }
  const missingIngredients = [];
  const expiringIngredients = [];
  let matchedAmountFraction = 0;
  let usedStock = false;
  for (const [key, amount] of required) {
    const [name, unit] = key.split('\0');
    const available = stock.get(key);
    const used = Math.min(amount, available?.amount ?? 0);
    if (used > 0) {
      usedStock = true;
      if (daysUntil(available.earliestExpiry, today) <= 3) expiringIngredients.push(name);
    }
    matchedAmountFraction += used / amount;
    if (used < amount) missingIngredients.push({ name, amount: Math.round((amount - used) * 1000) / 1000, unit });
  }
  return {
    ...recipe,
    matchRate: Math.round((matchedAmountFraction / required.size) * 100),
    canCook: missingIngredients.length === 0,
    missingIngredients,
    expiringIngredients,
    usedStock,
  };
}

export async function recommendRecipes(items, options) {
  const today = new Date().toISOString().slice(0, 10);
  const inventory = items.filter((item) => daysUntil(item.expiry, today) >= 0)
    .map(({ name, amount, unit, expiry }) => ({ name, amount, unit, expiry }));
  if (inventory.length === 0) throw new InputError('소비기한이 지나지 않은 재료를 먼저 등록해 주세요.', 409);
  inventory.sort((a, b) => a.expiry.localeCompare(b.expiry));
  const inventoryWithDays = inventory.map((item) => ({ ...item, daysUntilExpiry: daysUntil(item.expiry, today) }));
  const result = await gemini(
    `오늘은 ${today}입니다. 다음은 실제 냉장고 재고(JSON)입니다: ${JSON.stringify(inventoryWithDays)}.\n` +
    '이 재료로 지금 만들 만한 서로 다른 요리 3가지를 추천하세요. 소비기한이 3일 이내인 재료를 우선 사용하세요. ' +
    'ingredients의 보유 재료명과 단위는 위 JSON과 정확히 같게 적고, 여러 묶음의 수량을 합산해 사용하세요. ' +
    '가능하면 보유량만으로 조리하고 부족한 재료가 꼭 필요하면 최소한만 추가하세요. ' +
    '소금·식용유 등 기본 양념은 있다고 가정하되 ingredients에는 적지 마세요. ' +
    '현실적인 분량과 2단계 이상의 구체적인 조리법을 한국어로 작성하세요. 칼로리는 추정치입니다. JSON 배열만 반환하세요.',
    null, { ...options, schema: RECOMMENDATION_SCHEMA },
  );
  if (!Array.isArray(result)) throw new InputError('AI 추천 결과 형식이 올바르지 않습니다.', 502);
  try {
    const names = new Set();
    const recipes = result.map(recipeInput)
      .filter((recipe) => {
        if (recipe.manual.length < 2 || names.has(recipe.name)) return false;
        names.add(recipe.name);
        return true;
      })
      .map((recipe) => measureRecipe(recipe, inventory, today))
      .filter((recipe) => recipe.usedStock)
      .sort((a, b) => (Number(b.canCook) - Number(a.canCook)) ||
        (b.expiringIngredients.length - a.expiringIngredients.length) || (b.matchRate - a.matchRate))
      .slice(0, 3)
      .map((recipe) => {
        const output = { ...recipe };
        delete output.usedStock;
        return output;
      });
    if (recipes.length === 0) throw new InputError('현재 재고를 활용한 추천을 만들지 못했습니다.', 502);
    return recipes;
  } catch (error) {
    if (error instanceof InputError && error.status === 502) throw error;
    throw new InputError('AI 추천 결과의 레시피 형식이 올바르지 않습니다.', 502);
  }
}

function parseIngredients(rawText) {
  if (!rawText) return [];
  const seen = new Set();
  return rawText.split(/,|\n/).flatMap((part) => {
    const clean = part.replace(/\[.*?\]|\(.*?\)/g, '').replace(/주재료|부재료|양념장|소스/g, '').trim();
    const match = clean.match(/^([가-힣a-zA-Z\s]+?)\s*(\d+(?:\/\d+|\.\d+)?)\s*(개|g|ml|모|봉지|줄기|대|토막|쪽)?$/);
    if (!match) return [];
    const name = match[1].trim();
    if (!name || seen.has(name)) return [];
    seen.add(name);
    const amount = match[2].includes('/')
      ? Number(match[2].split('/')[0]) / Number(match[2].split('/')[1])
      : Number(match[2]);
    return Number.isFinite(amount) && amount > 0 ? [{ name, amount, unit: match[3] ?? '개' }] : [];
  });
}

export async function searchPublicRecipes(query, { apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new InputError('서버에 RECIPE_API_KEY가 설정되지 않았습니다.', 503);
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length > 100) throw new InputError('검색어는 1~100자여야 합니다.');
  const url = `https://openapi.foodsafetykorea.go.kr/api/${encodeURIComponent(apiKey)}/COOKRCP01/json/1/20/RCP_NM=${encodeURIComponent(trimmed)}`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new InputError(`공공 레시피 검색이 실패했습니다. (${response.status})`, 502);
  const data = await response.json();
  const rows = data.COOKRCP01?.row ?? [];
  if (!Array.isArray(rows)) throw new InputError('공공 레시피 응답 형식이 올바르지 않습니다.', 502);
  return rows.map((row) => ({
    id: `gov-${row.RCP_SEQ}`,
    name: row.RCP_NM,
    imageUrl: row.ATT_FILE_NO_MAIN || null,
    calorie: row.INFO_ENG ? `${row.INFO_ENG} kcal` : null,
    ingredients: parseIngredients(row.RCP_PARTS_DTLS),
    manual: Array.from({ length: 20 }, (_, index) => row[`MANUAL${String(index + 1).padStart(2, '0')}`])
      .filter(Boolean).map((step) => step.replace(/^[0-9]+\.\s*/, '').trim()),
  }));
}
