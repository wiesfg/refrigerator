import { useState, useEffect, useRef } from 'react';
import './App.css';

const STORAGE_KEY = 'refrigerator_items_v2';
const RECIPE_STORAGE_KEY = 'refrigerator_recipes_v2';
// 식약처 레시피 재료 문자열 파서 함수
function parseRecipeIngredients(rawText) {
  if (!rawText) return [];

  const rawItems = rawText.split(/,|\n/);
  const parsed = [];
  const seen = new Set();

  rawItems.forEach((item) => {
    let clean = item.replace(/\[.*?\]|\(.*?\)/g, '').trim();
    clean = clean.replace(/주재료|부재료|양념장|소스/g, '').trim();
    if (!clean) return;

    const match = clean.match(/^([가-힣a-zA-Z\s]+?)\s*(\d+(?:\/\d+|\.\d+)?)\s*(개|g|ml|모|봉지|줄기|대|토막|쪽)?$/);

    if (match) {
      const name = match[1].trim();
      let amount = match[2];

      if (amount.includes('/')) {
        const [top, bottom] = amount.split('/');
        amount = Math.round((Number(top) / Number(bottom)) * 10) / 10;
      } else {
        amount = Number(amount);
      }

      if (name && !seen.has(name)) {
        seen.add(name);
        parsed.push({
          name,
          amount: isNaN(amount) || amount <= 0 ? 1 : amount,
          unit: match[3] || '개',
        });
      }
    } else {
      const parts = clean.split(/\s+/);
      const name = parts[0]?.trim();
      if (name && name.length >= 2 && !seen.has(name)) {
        seen.add(name);
        parsed.push({
          name,
          amount: 1,
          unit: '개',
        });
      }
    }
  });

  return parsed;
}
const DEFAULT_ITEMS = [
  { id: 1, name: '계란', amount: 6, unit: '개', location: '냉장', expiry: '2026-09-20' },
  { id: 2, name: '양파', amount: 3, unit: '개', location: '실온', expiry: '2026-09-28' },
  { id: 3, name: '김치', amount: 300, unit: 'g', location: '냉장', expiry: '2026-10-15' },
  { id: 4, name: '스팸', amount: 200, unit: 'g', location: '실온', expiry: '2026-11-01' },
  { id: 5, name: '대파', amount: 2, unit: '개', location: '냉장', expiry: '2026-09-22' },
  { id: 6, name: '두부', amount: 1, unit: '모', location: '냉장', expiry: '2026-09-25' },
];

const DEFAULT_RECIPES = [
  {
    id: 'rec-1',
    name: '스팸마요덮밥',
    calorie: '480 kcal',
    ingredients: [
      { name: '스팸', amount: 100, unit: 'g' },
      { name: '계란', amount: 1, unit: '개' },
      { name: '양파', amount: 1, unit: '개' },
    ],
  },
  {
    id: 'rec-2',
    name: '김치볶음밥',
    calorie: '520 kcal',
    ingredients: [
      { name: '김치', amount: 150, unit: 'g' },
      { name: '스팸', amount: 100, unit: 'g' },
      { name: '계란', amount: 1, unit: '개' },
      { name: '대파', amount: 1, unit: '개' },
    ],
  },
];

export default function App() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ITEMS;
    } catch {
      return DEFAULT_ITEMS;
    }
  });

  const [recipes, setRecipes] = useState(() => {
    try {
      const saved = localStorage.getItem(RECIPE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_RECIPES;
    } catch {
      return DEFAULT_RECIPES;
    }
  });

  const [filterLocation, setFilterLocation] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');

  // AI 영수증 OCR 상태
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');
  const [scannedResults, setScannedResults] = useState([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  // 공공 레시피 검색 모달 상태
  const [isRecipeSearchOpen, setIsRecipeSearchOpen] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState('');
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const [publicRecipeResults, setPublicRecipeResults] = useState([]);

  // 🔥 내 냉장고 기반 AI 메뉴 추천 모달 상태
  const [isAiRecommendOpen, setIsAiRecommendOpen] = useState(false);
  const [isAiRecommending, setIsAiRecommending] = useState(false);
  const [aiRecommendedRecipes, setAiRecommendedRecipes] = useState([]);

  const [form, setForm] = useState({
    name: '',
    amount: '',
    unit: '개',
    location: '냉장',
    expiry: '',
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(recipes));
  }, [recipes]);

  const getDDay = (expiryStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryStr);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `만료 (${Math.abs(diffDays)}일 지남)`, isDanger: true };
    if (diffDays === 0) return { text: 'D-Day', isDanger: true };
    return { text: `D-${diffDays}`, isDanger: diffDays <= 3 };
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount || !form.expiry) {
      return alert('재료명, 수량, 유통기한을 모두 입력해주세요!');
    }

    const newItem = {
      id: Date.now(),
      name: form.name.trim(),
      amount: Number(form.amount),
      unit: form.unit,
      location: form.location,
      expiry: form.expiry,
    };

    setItems([...items, newItem]);
    setForm({ name: '', amount: '', unit: '개', location: '냉장', expiry: '' });
  };

  const handleUpdateAmount = (id, delta) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const step = target.unit === 'g' || target.unit === 'ml' ? 50 : 1;
    const newAmount = target.amount + delta * step;

    if (newAmount <= 0) {
      if (confirm(`'${target.name}'을(를) 모두 사용하여 목록에서 삭제할까요?`)) {
        setItems(items.filter((item) => item.id !== id));
      }
      return;
    }

    setItems(items.map((item) => (item.id === id ? { ...item, amount: newAmount } : item)));
  };

  const handleDeleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleResetData = () => {
    if (confirm('기본 샘플 재료 및 레시피 데이터로 초기화하시겠습니까?')) {
      setItems(DEFAULT_ITEMS);
      setRecipes(DEFAULT_RECIPES);
    }
  };

  // 1. Gemini 영수증 OCR 분석
  const analyzeReceiptWithGemini = async (base64Data, mimeType) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('API_KEY_MISSING');

    const todayStr = new Date().toISOString().split('T')[0];
    const prompt = `
이 이미지는 마트 영수증 또는 식료품 구매 목록입니다.
이미지에서 구매한 '식재료' 품목만 정확히 추출해 주세요. (공산품, 잡화, 결제정보 제외)
오늘 날짜는 ${todayStr} 입니다. 각 식재료의 일반적인 유통기한을 추정하여 expiry(YYYY-MM-DD)를 산출해 주세요.

반드시 다른 설명 없이 아래 JSON 배열 형식으로만 응답해 주세요:
[
  {
    "name": "식재료명",
    "amount": 숫자,
    "unit": "개" | "g" | "ml" | "모" | "봉지",
    "location": "냉장" | "냉동" | "실온",
    "expiry": "YYYY-MM-DD"
  }
]
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `API 요청 실패 (${response.status})`);
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonText);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsScanning(true);
    setScanStatusText('Gemini AI가 영수증 식재료를 분석 중입니다...');
    setScannedResults([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      setPreviewImage(dataUrl);

      try {
        const base64Data = dataUrl.split(',')[1];
        const mimeType = file.type || 'image/jpeg';
        const parsedItems = await analyzeReceiptWithGemini(base64Data, mimeType);

        const formatted = parsedItems.map((item, idx) => ({
          id: `ai-${Date.now()}-${idx}`,
          name: item.name || '식재료',
          amount: Number(item.amount) || 1,
          unit: item.unit || '개',
          location: item.location || '냉장',
          expiry: item.expiry || new Date().toISOString().split('T')[0],
          checked: true,
        }));

        setScannedResults(formatted);
      } catch (err) {
        console.error('Gemini Error:', err);
        alert(`AI 분석 중 오류가 발생했습니다: ${err.message}`);
      } finally {
        setIsScanning(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddScannedItems = () => {
    const selected = scannedResults.filter((r) => r.checked);
    if (selected.length === 0) return alert('추가할 식재료를 최소 하나 선택해주세요.');

    const newEntries = selected.map((r) => ({
      id: Date.now() + Math.random(),
      name: r.name.trim(),
      amount: Number(r.amount) || 1,
      unit: r.unit,
      location: r.location,
      expiry: r.expiry,
    }));

    setItems([...items, ...newEntries]);
    setIsScanModalOpen(false);
    setScannedResults([]);
    setUploadedFileName('');
    setPreviewImage(null);
  };

  // 🔥 2. Gemini AI에게 현재 냉장고 재료 기반 메뉴 추천 요청
  const handleRequestAiRecommendations = async () => {
    if (items.length === 0) {
      return alert('냉장고에 보관 중인 재료가 없습니다. 재료를 먼저 등록해 주세요!');
    }

    setIsAiRecommendOpen(true);
    setIsAiRecommending(true);
    setAiRecommendedRecipes([]);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setIsAiRecommending(false);
      return alert('.env 파일에 VITE_GEMINI_API_KEY를 설정해 주세요!');
    }

    // 재료 목록 문자열 구성
    const ingredientListText = items
      .map((item) => `${item.name}(${item.amount}${item.unit}, 유통기한: ${item.expiry})`)
      .join(', ');

    const prompt = `
당신은 최고의 요리사이자 냉장고 털기 전문 셰프입니다.
현재 내 냉장고에 있는 재료 목록: [ ${ingredientListText} ]

요구사항:
1. 내 냉장고에 있는 재료들을 최대한 활용하고, 특히 유통기한이 임박한 재료를 우선적으로 소진할 수 있는 현실적인 요리 3가지를 추천해 주세요.
2. 양념(소금, 설탕, 간장, 고춧가루, 식용유 등 기본 양념)은 집에 있다고 가정해도 좋습니다.
3. 반드시 다른 텍스트 설명 없이 오직 아래 형식의 JSON 배열(Array)만 출력하세요:

[
  {
    "name": "요리 이름 (예: 차돌 두부 된장조림)",
    "description": "한 줄 요리 소개 및 추천 이유",
    "calorie": "대략적인 칼로리 (예: 320 kcal)",
    "ingredients": [
      { "name": "재료명", "amount": 숫자, "unit": "개" | "g" | "ml" | "모" | "봉지" }
    ],
    "manual": [
      "1단계 조리법",
      "2단계 조리법",
      "3단계 조리법"
    ]
  }
]
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API 요청 실패 (${response.status})`);
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedRecipes = JSON.parse(cleanJsonText);

      setAiRecommendedRecipes(parsedRecipes);
    } catch (err) {
      console.error('AI 추천 실패:', err);
      alert('AI 요리 추천을 불러오는 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsAiRecommending(false);
    }
  };

  // 공공데이터 레시피 검색
  const handleSearchPublicRecipe = async (e) => {
    e?.preventDefault();
    if (!recipeQuery.trim()) return alert('검색할 요리명을 입력해주세요.');

    setIsRecipeLoading(true);
    setPublicRecipeResults([]);

    const apiKey = import.meta.env.VITE_RECIPE_API_KEY;

    try {
      if (apiKey) {
        const url = `/api/recipe/${apiKey}/COOKRCP01/json/1/10/RCP_NM=${encodeURIComponent(recipeQuery.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        const rows = data.COOKRCP01?.row;

        if (rows && rows.length > 0) {
          const parsedList = rows.map((r, idx) => ({
            id: `gov-${Date.now()}-${idx}`,
            name: r.RCP_NM,
            imageUrl: r.ATT_FILE_NO_MAIN || null,
            calorie: r.INFO_ENG ? `${r.INFO_ENG} kcal` : null,
            ingredients: parseRecipeIngredients(r.RCP_PARTS_DTLS),
            manual: [r.MANUAL01, r.MANUAL02, r.MANUAL03].filter(Boolean).map((m) => m.replace(/^[0-9]+\.\s*/, '')),
          }));
          setPublicRecipeResults(parsedList);
          setIsRecipeLoading(false);
          return;
        }
      }

      const fallbackDatabase = [
        {
          id: `fb-1`,
          name: `${recipeQuery} 볶음`,
          calorie: '340 kcal',
          ingredients: [
            { name: recipeQuery, amount: 150, unit: 'g' },
            { name: '양파', amount: 1, unit: '개' },
            { name: '대파', amount: 1, unit: '개' },
          ],
          manual: ['재료를 한입 크기로 썰어 준비합니다.', '팬에 기름을 두르고 재료를 강불에 볶아줍니다.'],
        },
      ];
      setPublicRecipeResults(fallbackDatabase);
    } catch (err) {
      console.error('레시피 검색 오류:', err);
      alert('레시피 검색 중 오류가 발생했습니다.');
    } finally {
      setIsRecipeLoading(false);
    }
  };

  // 레시피를 내 추천 목록으로 저장
  const handleImportRecipe = (recipe) => {
    if (recipes.some((r) => r.name === recipe.name)) {
      return alert('이미 등록되어 있는 레시피입니다.');
    }
    const newRecipe = {
      ...recipe,
      id: `saved-${Date.now()}-${Math.random()}`,
    };
    setRecipes([newRecipe, ...recipes]);
    alert(`[${recipe.name}] 레시피가 내 요리 목록에 추가되었습니다!`);
  };

  // 요리 완성 및 재료 차감
  const handleCookRecipe = (recipe) => {
    const deductInfo = [];
    recipe.ingredients.forEach((reqIng) => {
      const existing = items.find((i) => i.name === reqIng.name);
      if (existing) {
        deductInfo.push(`${reqIng.name} ${reqIng.amount}${reqIng.unit}`);
      }
    });

    if (
      !confirm(
        `[${recipe.name}] 조리를 완료하시겠습니까?\n냉장고에서 아래 재료가 차감됩니다:\n- ${deductInfo.join('\n- ')}`
      )
    ) {
      return;
    }

    let updated = [...items];
    recipe.ingredients.forEach((reqIng) => {
      const targetIdx = updated.findIndex((i) => i.name === reqIng.name);
      if (targetIdx !== -1) {
        const currentItem = updated[targetIdx];
        const remainAmount = currentItem.amount - reqIng.amount;

        if (remainAmount <= 0) {
          updated.splice(targetIdx, 1);
        } else {
          updated[targetIdx] = { ...currentItem, amount: remainAmount };
        }
      }
    });

    setItems(updated);
  };

  const filteredItems = items.filter((item) => {
    const matchesLoc = filterLocation === '전체' || item.location === filterLocation;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLoc && matchesSearch;
  });

  const totalStockCount = items.length;
  const urgentCount = items.filter((item) => getDDay(item.expiry).isDanger).length;
  const currentItemNames = items.map((i) => i.name);

  const recipeMatches = recipes.map((recipe) => {
    const matched = recipe.ingredients.filter((req) => currentItemNames.includes(req.name));
    const rate = recipe.ingredients.length > 0
      ? Math.round((matched.length / recipe.ingredients.length) * 100)
      : 0;
    return { ...recipe, matched, matchRate: rate };
  }).sort((a, b) => b.matchRate - a.matchRate);

  return (
    <div className="container">
      <header>
        <div>
          <div className="brand-title">
            <h1>🧊 Refrigerator</h1>
          </div>
          <p className="subtext">냉장고 재료 소진 & AI 맞춤 요리 추천 시스템</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* 🔥 AI 맞춤 메뉴 추천 버튼 추가 */}
          <button
            onClick={handleRequestAiRecommendations}
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', border: 'none' }}
          >
            ✨ AI 냉장고 파먹기 추천
          </button>
          <button onClick={() => setIsRecipeSearchOpen(true)} className="btn-secondary" style={{ borderColor: '#3b82f6', color: '#1d4ed8' }}>
            📖 공공 레시피 검색
          </button>
          <button onClick={() => setIsScanModalOpen(true)} className="btn-scan">
            📷 영수증 스캔
          </button>
          <button onClick={handleResetData} className="btn-secondary">
            🔄 리셋
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <h3>보관 중인 재료 종류</h3>
          <div className="value">{totalStockCount}종</div>
        </div>
        <div className="stat-card warning">
          <h3>유통기한 임박 / 만료 (D-3)</h3>
          <div className="value">{urgentCount}개</div>
        </div>
        <div className="stat-card">
          <h3>요리 가능 레시피 (매칭 50%↑)</h3>
          <div className="value">{recipeMatches.filter((r) => r.matchRate >= 50).length}개</div>
        </div>
      </section>

      <main className="main-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>내 냉장고 재료</h2>
          </div>

          <form onSubmit={handleAddItem} className="form-box">
            <div className="form-grid-row1">
              <input
                type="text"
                placeholder="식재료명 (예: 감자)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                type="number"
                min="1"
                placeholder="수량"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option value="개">개</option>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="봉지">봉지</option>
                <option value="모">모</option>
              </select>
            </div>

            <div className="form-grid-row2">
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              >
                <option value="냉장">보관: 냉장</option>
                <option value="냉동">보관: 냉동</option>
                <option value="실온">보관: 실온</option>
              </select>

              <div className="date-wrapper">
                <span className="date-label">유통기한:</span>
                <input
                  type="date"
                  value={form.expiry}
                  onChange={(e) => setForm({ ...form, expiry: e.target.value })}
                />
              </div>

              <button type="submit" className="btn-primary">추가</button>
            </div>
          </form>

          <div className="tab-group">
            {['전체', '냉장', '냉동', '실온'].map((loc) => (
              <button
                key={loc}
                className={`tab-btn ${filterLocation === loc ? 'active' : ''}`}
                onClick={() => setFilterLocation(loc)}
              >
                {loc === '냉장' ? '❄️ 냉장' : loc === '냉동' ? '🧊 냉동' : loc === '실온' ? '🧺 실온' : '전체'}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="search-input"
            placeholder="🔍 보관 중인 재료 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="item-list">
            {filteredItems.length === 0 ? (
              <div className="empty-state">해당하는 식재료가 없습니다.</div>
            ) : (
              filteredItems.map((item) => {
                const dday = getDDay(item.expiry);
                return (
                  <div key={item.id} className="item-card">
                    <div className="item-left">
                      <span className="item-name">{item.name}</span>
                      <span className={`badge-loc ${item.location}`}>{item.location}</span>
                    </div>

                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="btn-step btn-minus"
                        onClick={() => handleUpdateAmount(item.id, -1)}
                      >
                        -
                      </button>
                      <span className="qty-val">
                        {item.amount} {item.unit}
                      </span>
                      <button
                        type="button"
                        className="btn-step btn-plus"
                        onClick={() => handleUpdateAmount(item.id, 1)}
                      >
                        +
                      </button>
                    </div>

                    <div className="item-right">
                      <span className={`dday ${dday.isDanger ? 'danger' : 'safe'}`}>
                        {dday.text}
                      </span>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>내 요리 & 추천 레시피 ({recipes.length})</h2>
            <button
              onClick={handleRequestAiRecommendations}
              style={{
                fontSize: '12px',
                padding: '5px 10px',
                background: '#f5f3ff',
                color: '#6d28d9',
                border: '1px solid #ddd6fe',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✨ 냉장고 파먹기 추천
            </button>
          </div>

          <div className="item-list">
            {recipeMatches.map((recipe) => (
              <div key={recipe.id} className="recipe-card">
                <div className="recipe-header">
                  <div>
                    <span className="recipe-name">{recipe.name}</span>
                    {recipe.calorie && (
                      <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                        ({recipe.calorie})
                      </span>
                    )}
                  </div>
                  <span className={`match-rate ${recipe.matchRate >= 60 ? 'high' : 'low'}`}>
                    매칭 {recipe.matchRate}%
                  </span>
                </div>

                {recipe.imageUrl && (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.name}
                    style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '8px', margin: '6px 0' }}
                  />
                )}

                <div className="ingredient-tags">
                  {recipe.ingredients.map((req) => {
                    const has = currentItemNames.includes(req.name);
                    return (
                      <span key={req.name} className={`ing-tag ${has ? 'has' : 'missing'}`}>
                        {has ? `✓ ${req.name} ${req.amount}${req.unit}` : `${req.name} ${req.amount}${req.unit}`}
                      </span>
                    );
                  })}
                </div>

                <button
                  className="btn-cook"
                  disabled={recipe.matched.length === 0}
                  onClick={() => handleCookRecipe(recipe)}
                >
                  🍳 요리 완성 (필요 수량 자동 차감)
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 🔥 모달 1: AI 냉장고 맞춤 요리 추천 모달 */}
      {isAiRecommendOpen && (
        <div className="modal-backdrop" onClick={() => setIsAiRecommendOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✨ AI 냉장고 파먹기 요리 추천</h3>
              <button className="btn-close" onClick={() => setIsAiRecommendOpen(false)}>✕</button>
            </div>

            {isAiRecommending ? (
              <div className="scanning-state" style={{ padding: '40px 0' }}>
                <div className="spinner"></div>
                <p style={{ fontWeight: 600, color: '#1e293b', marginTop: '16px' }}>
                  현재 보관 중인 재료와 소비기한을 분석 중입니다...
                </p>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  식재료 낭비를 줄일 수 있는 최적의 레시피 3가지를 생성하고 있습니다.
                </span>
              </div>
            ) : (
              <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                  현재 냉장고 재료를 바탕으로 AI 셰프가 제안하는 요리입니다. 마음에 드는 요리를 <strong>내 레시피로 추가</strong>해 보세요!
                </p>

                {aiRecommendedRecipes.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '12px',
                      background: '#faf5ff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '16px', color: '#581c87' }}>{item.name}</strong>
                        {item.calorie && (
                          <span style={{ fontSize: '12px', color: '#7c3aed', marginLeft: '8px', fontWeight: 600 }}>
                            ⚡ {item.calorie}
                          </span>
                        )}
                      </div>
                      <button
                        className="btn-primary"
                        style={{ fontSize: '12px', padding: '6px 12px', background: '#7c3aed' }}
                        onClick={() => handleImportRecipe(item)}
                      >
                        + 내 레시피로 저장
                      </button>
                    </div>

                    <p style={{ fontSize: '13px', color: '#6b21a8', margin: '0 0 10px 0' }}>
                      💡 {item.description}
                    </p>

                    <div style={{ fontSize: '12px', color: '#334155', marginBottom: '8px' }}>
                      <strong>필요 재료:</strong>{' '}
                      {item.ingredients.map((ing) => `${ing.name} ${ing.amount}${ing.unit}`).join(', ')}
                    </div>

                    {item.manual && (
                      <div style={{ fontSize: '12px', color: '#475569', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #f3e8ff' }}>
                        <strong style={{ color: '#6b21a8' }}>간단 조리 순서:</strong>
                        <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                          {item.manual.map((step, sIdx) => (
                            <li key={sIdx} style={{ marginBottom: '4px' }}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모달 2: 공공 레시피 검색 모달 */}
      {isRecipeSearchOpen && (
        <div className="modal-backdrop" onClick={() => setIsRecipeSearchOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📖 공공데이터 식품안전나라 레시피 검색</h3>
              <button className="btn-close" onClick={() => setIsRecipeSearchOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSearchPublicRecipe} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                placeholder="요리명 검색 (예: 된장찌개, 비빔밥, 불고기)"
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0 18px' }} disabled={isRecipeLoading}>
                {isRecipeLoading ? '검색 중...' : '검색'}
              </button>
            </form>

            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {publicRecipeResults.length === 0 && !isRecipeLoading && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>
                  궁금한 요리명을 검색해 보세요! 식품의약품안전처 조리식품 DB에서 표준 조리법을 찾아옵니다.
                </div>
              )}

              {publicRecipeResults.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '15px', color: '#1e293b' }}>{item.name}</strong>
                      {item.calorie && (
                        <span style={{ fontSize: '12px', color: '#059669', marginLeft: '8px', fontWeight: 600 }}>
                          🔥 {item.calorie}
                        </span>
                      )}
                    </div>
                    <button
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '5px 12px' }}
                      onClick={() => handleImportRecipe(item)}
                    >
                      + 내 레시피로 추가
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ fontSize: '12px', color: '#475569', flex: 1 }}>
                      <strong>필요 식재료:</strong>{' '}
                      {item.ingredients.map((ing) => `${ing.name}(${ing.amount}${ing.unit})`).join(', ') || '재료 정보 없음'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 모달 3: 영수증 스캔 모달 */}
      {isScanModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setIsScanModalOpen(false);
            setUploadedFileName('');
            setPreviewImage(null);
            setScannedResults([]);
          }}
        >
          <div className="modal-content" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✨ AI 영수증 자동 인식</h3>
              <button
                className="btn-close"
                onClick={() => {
                  setIsScanModalOpen(false);
                  setUploadedFileName('');
                  setPreviewImage(null);
                  setScannedResults([]);
                }}
              >
                ✕
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />

            {!isScanning && scannedResults.length === 0 && (
              <div>
                <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
                  <div className="dropzone-icon">🧾</div>
                  <p>영수증 사진을 선택하세요</p>
                  <span>Gemini AI가 영수증에서 식재료와 수량을 분석합니다</span>
                </div>
                <button style={{ width: '100%' }} className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                  영수증 이미지 선택하기
                </button>
              </div>
            )}

            {isScanning && (
              <div className="scanning-state">
                <div className="spinner"></div>
                <p style={{ fontWeight: 600, color: '#1e293b' }}>{scanStatusText}</p>
                <span style={{ fontSize: '12px', color: '#64748b' }}>[{uploadedFileName}] 이미지를 분석하고 있습니다.</span>
              </div>
            )}

            {!isScanning && scannedResults.length > 0 && (
              <div>
                {previewImage && (
                  <div
                    style={{
                      textAlign: 'center',
                      marginBottom: '14px',
                      background: '#f8fafc',
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <img
                      src={previewImage}
                      alt="Uploaded Receipt"
                      style={{ maxHeight: '130px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }}
                    />
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>파일명: {uploadedFileName}</div>
                  </div>
                )}

                <p style={{ fontSize: '13px', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>
                  인식 완료! 식재료 정보를 확인하고 수정 후 등록하세요:
                </p>

                <div className="scanned-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {scannedResults.map((item) => (
                    <div key={item.id} className="scanned-item-edit">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => setScannedResults(scannedResults.map((r) => (r.id === item.id ? { ...r, checked: !r.checked } : r)))}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => setScannedResults(scannedResults.map((r) => (r.id === item.id ? { ...r, name: e.target.value } : r)))}
                        placeholder="품명"
                        style={{ width: '80px', padding: '4px 6px', fontWeight: 600 }}
                      />
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => setScannedResults(scannedResults.map((r) => (r.id === item.id ? { ...r, amount: e.target.value } : r)))}
                        min="1"
                        style={{ width: '55px', padding: '4px 6px' }}
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => setScannedResults(scannedResults.map((r) => (r.id === item.id ? { ...r, unit: e.target.value } : r)))}
                        style={{ padding: '4px' }}
                      >
                        <option value="개">개</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="모">모</option>
                        <option value="봉지">봉지</option>
                      </select>
                      <select
                        value={item.location}
                        onChange={(e) => setScannedResults(scannedResults.map((r) => (r.id === item.id ? { ...r, location: e.target.value } : r)))}
                        style={{ padding: '4px' }}
                      >
                        <option value="냉장">냉장</option>
                        <option value="냉동">냉동</option>
                        <option value="실온">실온</option>
                      </select>
                      <input
                        type="date"
                        value={item.expiry}
                        onChange={(e) => setScannedResults(scannedResults.map((r) => (r.id === item.id ? { ...r, expiry: e.target.value } : r)))}
                        style={{ fontSize: '12px', padding: '3px' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setScannedResults([]);
                      setUploadedFileName('');
                      setPreviewImage(null);
                    }}
                  >
                    다시 올리기
                  </button>
                  <button className="btn-primary" style={{ flex: 2 }} onClick={handleAddScannedItems}>
                    선택한 재료 냉장고에 등록
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}