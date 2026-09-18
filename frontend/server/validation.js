export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const UNITS = new Set(['개', 'g', 'ml', '모', '봉지', '줄기', '대', '토막', '쪽']);
const LOCATIONS = new Set(['냉장', '냉동', '실온']);

function string(value, field, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new InputError(`${field}은(는) 1~${max}자의 문자열이어야 합니다.`);
  }
  return value.trim();
}

function positiveNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    throw new InputError(`${field}은(는) 0보다 큰 숫자여야 합니다.`);
  }
  return value;
}

function date(value) {
  const valueString = string(value, 'expiry', 10);
  const parsed = new Date(`${valueString}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueString) ||
      !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== valueString) {
    throw new InputError('expiry는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.');
  }
  return valueString;
}

export function itemInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('식재료 객체가 필요합니다.');
  const unit = string(value.unit, 'unit', 10);
  const location = string(value.location, 'location', 10);
  if (!UNITS.has(unit)) throw new InputError('지원하지 않는 단위입니다.');
  if (!LOCATIONS.has(location)) throw new InputError('보관 위치는 냉장, 냉동, 실온 중 하나여야 합니다.');
  return {
    name: string(value.name, 'name'),
    amount: positiveNumber(value.amount, 'amount'),
    unit,
    location,
    expiry: date(value.expiry),
  };
}

export function recipeInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('레시피 객체가 필요합니다.');
  if (!Array.isArray(value.ingredients) || value.ingredients.length === 0 || value.ingredients.length > 100) {
    throw new InputError('ingredients에는 재료가 1~100개 필요합니다.');
  }
  const ingredients = value.ingredients.map((ingredient) => {
    if (!ingredient || typeof ingredient !== 'object') throw new InputError('재료 형식이 올바르지 않습니다.');
    const unit = string(ingredient.unit, 'unit', 10);
    if (!UNITS.has(unit)) throw new InputError('지원하지 않는 단위입니다.');
    return {
      name: string(ingredient.name, 'ingredient.name'),
      amount: positiveNumber(ingredient.amount, 'ingredient.amount'),
      unit,
    };
  });
  if (value.manual != null && (!Array.isArray(value.manual) || value.manual.length > 50)) {
    throw new InputError('manual은 최대 50개 단계의 배열이어야 합니다.');
  }
  return {
    name: string(value.name, 'name'),
    description: value.description == null ? null : string(value.description, 'description', 500),
    calorie: value.calorie == null ? null : string(value.calorie, 'calorie', 50),
    imageUrl: value.imageUrl == null ? null : string(value.imageUrl, 'imageUrl', 2000),
    ingredients,
    manual: (value.manual ?? []).map((step) => string(step, 'manual step', 1000)),
  };
}

export function numericId(value) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new InputError('유효한 식재료 ID가 필요합니다.');
  }
  return Number(value);
}
