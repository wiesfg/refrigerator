import { useState, useEffect, useRef } from 'react';
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

  // AI OCR 상태
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');
  const [scannedResults, setScannedResults] = useState([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

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
    if (confirm('샘플 재료 데이터로 초기화하시겠습니까?')) {
      setItems(DEFAULT_ITEMS);
    }
  };

  const handleOpenFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Gemini Vision API 호출 분석 함수
  const analyzeReceiptWithGemini = async (base64Data, mimeType) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY_MISSING');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const prompt = `
이 이미지는 마트 영수증 또는 식료품 구매 목록입니다.
이미지에서 구매한 '식재료' 품목만 정확히 추출해 주세요. (공산품, 잡화, 결제정보, 할인내역 등은 제외)
오늘 날짜는 ${todayStr} 입니다. 각 식재료의 일반적인 유통기한(소비기한)을 추정하여 expiry(YYYY-MM-DD)를 산출해 주세요.

반드시 다른 설명 없이 아래 JSON 배열 형식으로만 응답해 주세요:
[
  {
    "name": "식재료명 (예: 애호박, 두부, 차돌박이)",
    "amount": 숫자 (수량, 기본값 1),
    "unit": "개" | "g" | "ml" | "모" | "봉지",
    "location": "냉장" | "냉동" | "실온",
    "expiry": "YYYY-MM-DD"
  }
]
`;

    // 기존 URL 수정: gemini-1.5-flash -> gemini-1.5-flash-latest
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
    
    // 마크다운 코드블록 제거 후 JSON 파싱
    const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonText);
  };

  // 파일 선택 및 AI 분석 시작
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

        if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
          throw new Error('식재료 항목을 찾지 못했습니다.');
        }

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
        console.error('Gemini Analysis Failed:', err);
        if (err.message === 'API_KEY_MISSING') {
          alert('.env 파일에 VITE_GEMINI_API_KEY를 설정해 주세요!');
        } else {
          alert(`AI 분석 중 오류가 발생했습니다: ${err.message}`);
        }
      } finally {
        setIsScanning(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditScannedField = (id, field, value) => {
    setScannedResults(
      scannedResults.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleToggleCheck = (id) => {
    setScannedResults(scannedResults.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
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
          <p className="subtext">냉장고 잔여 수량 관리 및 AI 영수증 자동 등록 시스템</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsScanModalOpen(true)} className="btn-scan">
            ✨ AI 영수증 스캔
          </button>
          <button onClick={handleResetData} className="btn-secondary">
            🔄 샘플 데이터 리셋
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

      {/* Gemini AI 영수증 모달 */}
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
          <div
            className="modal-content"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                <div className="dropzone" onClick={handleOpenFileDialog}>
                  <div className="dropzone-icon">🧾</div>
                  <p>영수증 사진을 선택하세요</p>
                  <span>AI 모델이 영수증에서 식재료와 수량을 분석합니다</span>
                </div>
                <button
                  style={{ width: '100%' }}
                  className="btn-primary"
                  onClick={handleOpenFileDialog}
                >
                  영수증 이미지 선택하기
                </button>
              </div>
            )}

            {isScanning && (
              <div className="scanning-state">
                <div className="spinner"></div>
                <p style={{ fontWeight: 600, color: '#1e293b' }}>
                  {scanStatusText}
                </p>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  [{uploadedFileName}] 이미지를 분석하고 있습니다.
                </span>
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
                      style={{
                        maxHeight: '130px',
                        maxWidth: '100%',
                        objectFit: 'contain',
                        borderRadius: '6px',
                      }}
                    />
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      파일명: {uploadedFileName}
                    </div>
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
                        onChange={() => handleToggleCheck(item.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleEditScannedField(item.id, 'name', e.target.value)}
                        placeholder="품명"
                        style={{ width: '80px', padding: '4px 6px', fontWeight: 600 }}
                      />
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => handleEditScannedField(item.id, 'amount', e.target.value)}
                        min="1"
                        style={{ width: '55px', padding: '4px 6px' }}
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => handleEditScannedField(item.id, 'unit', e.target.value)}
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
                        onChange={(e) => handleEditScannedField(item.id, 'location', e.target.value)}
                        style={{ padding: '4px' }}
                      >
                        <option value="냉장">냉장</option>
                        <option value="냉동">냉동</option>
                        <option value="실온">실온</option>
                      </select>
                      <input
                        type="date"
                        value={item.expiry}
                        onChange={(e) => handleEditScannedField(item.id, 'expiry', e.target.value)}
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
                  <button
                    className="btn-primary"
                    style={{ flex: 2 }}
                    onClick={handleAddScannedItems}
                  >
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