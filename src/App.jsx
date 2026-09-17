import { useState, useEffect } from 'react';
import './App.css';

const STORAGE_KEY = 'refrigerator_items_v2';

const DEFAULT_ITEMS = [
  { id: 1, name: '계란', amount: 6, unit: '개', location: '냉장', expiry: '2026-09-20' },
  { id: 2, name: '양파', amount: 3, unit: '개', location: '실온', expiry: '2026-09-28' },
  { id: 3, name: '김치', amount: 300, unit: 'g', location: '냉장', expiry: '2026-10-15' },
  { id: 4, name: '스팸', amount: 200, unit: 'g', location: '실온', expiry: '2026-11-01' },
  { id: 5, name: '대파', amount: 2, unit: '개', location: '냉장', expiry: '2026-09-22' },
];

const INITIAL_RECIPES = [
  {
    id: 1,
    name: '스팸마요덮밥',
    ingredients: [
      { name: '스팸', amount: 100, unit: 'g' },
      { name: '계란', amount: 1, unit: '개' },
      { name: '양파', amount: 1, unit: '개' },
    ],
  },
  {
    id: 2,
    name: '김치볶음밥',
    ingredients: [
      { name: '김치', amount: 150, unit: 'g' },
      { name: '스팸', amount: 100, unit: 'g' },
      { name: '계란', amount: 1, unit: '개' },
      { name: '대파', amount: 1, unit: '개' },
    ],
  },
  {
    id: 3,
    name: '양파 계란국',
    ingredients: [
      { name: '계란', amount: 2, unit: '개' },
      { name: '양파', amount: 1, unit: '개' },
      { name: '대파', amount: 1, unit: '개' },
    ],
  },
  {
    id: 4,
    name: '된장찌개',
    ingredients: [
      { name: '두부', amount: 1, unit: '모' },
      { name: '애호박', amount: 1, unit: '개' },
      { name: '양파', amount: 1, unit: '개' },
      { name: '차돌박이', amount: 100, unit: 'g' },
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

  const [filterLocation, setFilterLocation] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');

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

  // D-Day 계산
  const getDDay = (expiryStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryStr);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `만료 (${Math.abs(diffDays)}일 지남)`, isDanger: true };
    if (diffDays === 0) return { text: 'D-Day', isDanger: true };
    return { text: `D-${diffDays}`, isDanger: diffDays <= 3 };
  };

  // 재료 추가
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

  // 개별 수량 조절 (+ / - 버튼)
  const handleUpdateAmount = (id, delta) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    // 단위별 증감 단위 설정 (g, ml는 50 단위, 개/모/봉지는 1 단위)
    const step = (target.unit === 'g' || target.unit === 'ml') ? 50 : 1;
    const newAmount = target.amount + (delta * step);

    if (newAmount <= 0) {
      if (confirm(`'${target.name}'을(를) 모두 사용하여 목록에서 삭제할까요?`)) {
        setItems(items.filter((item) => item.id !== id));
      }
      return;
    }

    setItems(
      items.map((item) =>
        item.id === id ? { ...item, amount: newAmount } : item
      )
    );
  };

  // 재료 삭제
  const handleDeleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // 샘플 데이터 복구
  const handleResetData = () => {
    if (confirm('샘플 재료 데이터로 초기화하시겠습니까?')) {
      setItems(DEFAULT_ITEMS);
    }
  };

  // 요리 완성 처리
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
          updated[targetIdx] = {
            ...currentItem,
            amount: remainAmount,
          };
        }
      }
    });

    setItems(updated);
  };

  // 필터 및 검색
  const filteredItems = items.filter((item) => {
    const matchesLoc = filterLocation === '전체' || item.location === filterLocation;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLoc && matchesSearch;
  });

  const totalStockCount = items.length;
  const urgentCount = items.filter((item) => getDDay(item.expiry).isDanger).length;
  const currentItemNames = items.map((i) => i.name);

  // 레시피 매칭 순위
  const recipeMatches = INITIAL_RECIPES.map((recipe) => {
    const matched = recipe.ingredients.filter((req) => currentItemNames.includes(req.name));
    const rate = Math.round((matched.length / recipe.ingredients.length) * 100);
    return { ...recipe, matched, matchRate: rate };
  }).sort((a, b) => b.matchRate - a.matchRate);

  return (
    <div className="container">
      <header>
        <div>
          <div className="brand-title">
            <h1>🧊 Refrigerator</h1>
          </div>
          <p className="subtext">냉장고 잔여 수량 관리 및 정량 레시피 차감 시스템</p>
        </div>
        <button onClick={handleResetData} className="btn-secondary">
          🔄 샘플 데이터 리셋
        </button>
      </header>

      {/* 상단 통계 */}
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
        {/* 좌측: 재료 관리 */}
        <section className="panel">
          <div className="panel-header">
            <h2>내 냉장고 재료</h2>
          </div>

          {/* 재료 등록 폼 */}
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

          {/* 위치 탭 */}
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

          {/* 검색창 */}
          <input
            type="text"
            className="search-input"
            placeholder="🔍 보관 중인 재료 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* 재료 리스트 */}
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

                    {/* 수량 조절 버튼군 (+ / -) */}
                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="btn-step btn-minus"
                        onClick={() => handleUpdateAmount(item.id, -1)}
                        title="수량 감소"
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
                        title="수량 증가"
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
                        title="삭제"
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

        {/* 우측: 레시피 추천 */}
        <section className="panel">
          <div className="panel-header">
            <h2>재료 기반 추천 레시피</h2>
          </div>

          <div className="item-list">
            {recipeMatches.map((recipe) => (
              <div key={recipe.id} className="recipe-card">
                <div className="recipe-header">
                  <span className="recipe-name">{recipe.name}</span>
                  <span className={`match-rate ${recipe.matchRate >= 60 ? 'high' : 'low'}`}>
                    매칭 {recipe.matchRate}%
                  </span>
                </div>

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
    </div>
  );
}