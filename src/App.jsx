import { useState, useEffect } from 'react';
import './App.css';

const STORAGE_KEY = 'refrigerator_items';

const DEFAULT_ITEMS = [
  { id: 1, name: '계란', location: '냉장', expiry: '2026-09-20' },
  { id: 2, name: '양파', location: '실온', expiry: '2026-09-28' },
  { id: 3, name: '김치', location: '냉장', expiry: '2026-10-15' },
  { id: 4, name: '스팸', location: '실온', expiry: '2026-11-01' },
];

const INITIAL_RECIPES = [
  { id: 1, name: '스팸마요덮밥', ingredients: ['스팸', '계란', '양파'] },
  { id: 2, name: '김치볶음밥', ingredients: ['김치', '계란', '스팸', '대파'] },
  { id: 3, name: '양파 계란국', ingredients: ['계란', '양파', '대파'] },
  { id: 4, name: '된장찌개', ingredients: ['두부', '애호박', '양파', '차돌박이'] },
];

export default function App() {
  // localStorage에서 초기값 불러오기 (없으면 기본 mock 데이터 사용)
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ITEMS;
    } catch {
      return DEFAULT_ITEMS;
    }
  });

  const [form, setForm] = useState({ name: '', location: '냉장', expiry: '' });

  // items 상태가 바뀔 때마다 localStorage에 자동 동기화
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // D-Day 계산 함수
  const getDDay = (expiryStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryStr);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `만료 (${Math.abs(diffDays)}일 지남)`, isDanger: true };
    if (diffDays === 0) return { text: 'D-Day', isDanger: true };
    return { text: `D-${diffDays}`, isDanger: diffDays <= 3 };
  };

  // 재료 추가
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!form.name || !form.expiry) return alert('재료명과 소비기한을 입력해주세요!');

    setItems([...items, { ...form, id: Date.now() }]);
    setForm({ name: '', location: '냉장', expiry: '' });
  };

  // 재료 삭제
  const handleDeleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // 통계 계산
  const urgentCount = items.filter((item) => getDDay(item.expiry).isDanger).length;
  const currentItemNames = items.map((i) => i.name);

  // 레시피 매칭도 계산
  const recipeMatches = INITIAL_RECIPES.map((recipe) => {
    const matched = recipe.ingredients.filter((ing) => currentItemNames.includes(ing));
    const rate = Math.round((matched.length / recipe.ingredients.length) * 100);
    return { ...recipe, matched, matchRate: rate };
  }).sort((a, b) => b.matchRate - a.matchRate);

  return (
    <div className="container">
      <header>
        <div className="header-title">
          <h1>🧊 Refrigerator</h1>
        </div>
        <p className="subtext">냉장고 식재료 소비기한 관리 & 맞춤 요리 추천</p>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <h3>보관 중인 재료</h3>
          <div className="value">{items.length}개</div>
        </div>
        <div className="stat-card warning">
          <h3>소비기한 임박 / 만료</h3>
          <div className="value">{urgentCount}개</div>
        </div>
        <div className="stat-card">
          <h3>추천 가능 레시피</h3>
          <div className="value">{recipeMatches.filter((r) => r.matchRate >= 50).length}개</div>
        </div>
      </section>

      <main className="main-grid">
        {/* 재료 관리 패널 */}
        <section className="panel">
          <div className="panel-header">
            <h2>내 냉장고 재료</h2>
          </div>

          <form onSubmit={handleAddItem} className="form-group">
            <input
              type="text"
              placeholder="식재료명 (예: 대파)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            >
              <option value="냉장">냉장</option>
              <option value="냉동">냉동</option>
              <option value="실온">실온</option>
            </select>
            <input
              type="date"
              value={form.expiry}
              onChange={(e) => setForm({ ...form, expiry: e.target.value })}
            />
            <button type="submit" className="btn-primary">추가</button>
          </form>

          <div className="item-list">
            {items.map((item) => {
              const dday = getDDay(item.expiry);
              return (
                <div key={item.id} className="item-card">
                  <div className="item-meta">
                    <span className="item-name">{item.name}</span>
                    <span className="badge">{item.location}</span>
                  </div>
                  <div className="item-actions">
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
            })}
          </div>
        </section>

        {/* 레시피 추천 패널 */}
        <section className="panel">
          <div className="panel-header">
            <h2>재료 기반 추천 레시피</h2>
          </div>

          <div className="item-list">
            {recipeMatches.map((recipe) => (
              <div key={recipe.id} className="recipe-card">
                <div className="recipe-header">
                  <span className="recipe-name">{recipe.name}</span>
                  <span className="match-rate">재료 매칭 {recipe.matchRate}%</span>
                </div>
                <div className="ingredient-tags">
                  {recipe.ingredients.map((ing) => {
                    const has = currentItemNames.includes(ing);
                    return (
                      <span key={ing} className={`ing-tag ${has ? 'has' : 'missing'}`}>
                        {has ? `✓ ${ing}` : ing}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}