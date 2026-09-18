import { useState, useEffect, useRef } from 'react';
import ChatPanel from './components/ChatPanel';
import './App.css';

const STORAGE_KEY = 'refrigerator_items_v2';

const DEFAULT_ITEMS = [
  { id: 1, name: '계란', amount: 6, unit: '개', location: '냉장', expiry: '2026-09-22' },
  { id: 2, name: '양파', amount: 3, unit: '개', location: '실온', expiry: '2026-09-28' },
  { id: 3, name: '김치', amount: 300, unit: 'g', location: '냉장', expiry: '2026-10-15' },
  { id: 4, name: '스팸', amount: 200, unit: 'g', location: '실온', expiry: '2026-11-01' },
  { id: 5, name: '대파', amount: 2, unit: '개', location: '냉장', expiry: '2026-09-24' },
  { id: 6, name: '두부', amount: 1, unit: '모', location: '냉장', expiry: '2026-09-25' },
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

  // 좌측 사이드바 열림/닫힘 상태
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 사이드바 내부 필터 & 검색
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

  
  // 재료 직접 등록 폼 상태
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
      return alert('식재료명, 수량, 유통기한을 모두 입력해주세요!');
    }

    const newItem = {
      id: Date.now(),
      name: form.name.trim(),
      amount: Number(form.amount),
      unit: form.unit,
      location: form.location,
      expiry: form.expiry,
    };

    setItems([newItem, ...items]);
    setForm({ name: '', amount: '', unit: '개', location: '냉장', expiry: '' });
  };

  const handleUpdateAmount = (id, delta) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const step = target.unit === 'g' || target.unit === 'ml' ? 50 : 1;
    const newAmount = target.amount + delta * step;

    if (newAmount <= 0) {
      if (confirm(`'${target.name}'을(를) 모두 사용하여 목록에서 삭제하시겠습니까?`)) {
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
    if (confirm('샘플 식재료 데이터로 초기화하시겠습니까?')) {
      setItems(DEFAULT_ITEMS);
    }
  };

  // Gemini 영수증 OCR 분석
  const analyzeReceiptWithGemini = async (base64Data, mimeType) => {
    const response = await fetch('/api/ai/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mimeType }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `AI 서버 요청 실패 (${response.status})`);
    }

    const parsedItems = await response.json();
    if (!Array.isArray(parsedItems)) throw new Error('AI 응답 형식이 올바르지 않습니다.');
    return parsedItems;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsScanning(true);
    setScanStatusText('Gemini AI가 이미지에서 재료명과 수량을 분석 중입니다...');
    setScannedResults([]);

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
      alert('JPG, PNG, WEBP, HEIC 이미지 파일만 업로드할 수 있습니다.');
      e.target.value = '';
      setIsScanning(false);
      return;
    }

    const inputElement = e.target;
    const reader = new FileReader();
    reader.onerror = () => {
      setIsScanning(false);
      setScanStatusText('이미지를 읽지 못했습니다. 다시 시도해주세요.');
      inputElement.value = '';
    };
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      setPreviewImage(dataUrl);

      try {
        const base64Data = dataUrl.split(',')[1];
        if (!base64Data) throw new Error('이미지 데이터를 읽지 못했습니다.');
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
        inputElement.value = '';
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

    setItems([...newEntries, ...items]);
    setIsScanModalOpen(false);
    setScannedResults([]);
    setUploadedFileName('');
    setPreviewImage(null);
    setIsSidebarOpen(true); // 추가 후 확인하기 편하게 사이드바 열기
  };

 

  // 필터링된 재료 목록
  const filteredItems = items
    .filter((item) => {
      const matchesLoc = filterLocation === '전체' || item.location === filterLocation;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesLoc && matchesSearch;
    })
    .sort((a, b) => a.expiry.localeCompare(b.expiry));

  const totalStockCount = items.length;
  return (
    <div className="app-container">
      {/* 상단 통합 헤더 */}
      <header className="app-header">
        <div className="header-left">
          {/* 👈 왼쪽 상단 사이드바 토글 버튼 */}
          <button
            className="btn-toggle-sidebar"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="냉장고 재료 관리 열기"
          >
            ☰ 내 냉장고 ({totalStockCount})
          </button>
          <div className="brand-title">
            <h1>🧊 Refrigerator</h1>
          </div>
        </div>

        <div className="header-actions">
          <button type="button" onClick={() => setIsScanModalOpen(true)} className="btn-scan">
            📷 스캔
          </button>
          <button onClick={handleResetData} className="btn-secondary">
            🔄 리셋
          </button>
        </div>
      </header>

      {/* 👈 슬라이드 오버 사이드바 (내 냉장고 재료 추가 & 목록) */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`sidebar-drawer ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-top-bar">
          <div className="sidebar-title-area">
            <h2>내 냉장고 재료</h2>
            <span className="badge-count">{totalStockCount}종 보관 중</span>
          </div>
          <button className="btn-close-sidebar" onClick={() => setIsSidebarOpen(false)}>✕</button>
        </div>

        {/* 1. 재료 추가 폼 */}
        <div className="sidebar-section">
          <h3 className="section-label">➕ 새 식재료 추가</h3>
          <form onSubmit={handleAddItem} className="form-box-side">
            <input
              type="text"
              placeholder="식재료명 (예: 감자)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <div className="form-row-multi">
              <input
                type="number"
                min="1"
                placeholder="수량"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
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
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              >
                <option value="냉장">냉장</option>
                <option value="냉동">냉동</option>
                <option value="실온">실온</option>
              </select>
            </div>
            <div className="form-row-date">
              <input
                type="date"
                value={form.expiry}
                onChange={(e) => setForm({ ...form, expiry: e.target.value })}
                required
              />
              <button type="submit" className="btn-primary btn-add-side">등록</button>
            </div>
          </form>
        </div>

        {/* 2. 보관 재료 목록 */}
        <div className="sidebar-section list-section">
          <h3 className="section-label">📦 보관 중인 재료</h3>

          <div className="tab-group-side">
            {['전체', '냉장', '냉동', '실온'].map((loc) => (
              <button
                key={loc}
                className={`tab-btn-side ${filterLocation === loc ? 'active' : ''}`}
                onClick={() => setFilterLocation(loc)}
              >
                {loc}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="search-input-side"
            placeholder="🔍 재료 이름 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="sidebar-items-scroll">
            {filteredItems.length === 0 ? (
              <div className="empty-state">해당하는 재료가 없습니다.</div>
            ) : (
              filteredItems.map((item) => {
                const dday = getDDay(item.expiry);
                return (
                  <div key={item.id} className="side-item-card">
                    <div className="side-item-top">
                      <div className="side-item-name-wrap">
                        <span className="side-item-name">{item.name}</span>
                        <span className={`badge-loc ${item.location}`}>{item.location}</span>
                      </div>
                      <span className={`dday ${dday.isDanger ? 'danger' : 'safe'}`}>
                        {dday.text}
                      </span>
                    </div>

                    <div className="side-item-bottom">
                      <div className="qty-stepper-sm">
                        <button
                          type="button"
                          className="btn-step-sm"
                          onClick={() => handleUpdateAmount(item.id, -1)}
                        >
                          -
                        </button>
                        <span className="qty-val-sm">
                          {item.amount} {item.unit}
                        </span>
                        <button
                          type="button"
                          className="btn-step-sm"
                          onClick={() => handleUpdateAmount(item.id, 1)}
                        >
                          +
                        </button>
                      </div>

                      <button
                        className="btn-delete-sm"
                        onClick={() => handleDeleteItem(item.id)}
                        title="재료 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <main className="conversation-main">
        <ChatPanel ingredients={items.map((item) => item.name)} />
      </main>

      {/* 영수증 스캔 모달 */}
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
              <h3>✨ AI 이미지 재료 인식</h3>
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
                  <p>재료 사진 또는 영수증을 선택하세요</p>
                  <span>Gemini AI가 식재료 이름과 수량을 자동으로 인식합니다</span>
                </div>
                <button style={{ width: '100%' }} className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                  이미지 선택하기
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
                      alt="Uploaded Ingredient or Receipt"
                      style={{ maxHeight: '130px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }}
                    />
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>파일명: {uploadedFileName}</div>
                  </div>
                )}

                <p style={{ fontSize: '13px', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>
                  인식 완료! 재료명과 수량을 확인하고 수정한 뒤 등록하세요:
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
