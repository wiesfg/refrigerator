import { useEffect, useState } from 'react';
import { deleteSavedMenu, getSavedMenus } from '../api/chatApi';

export default function SavedMenusPanel({ onCook }) {
  const [menus, setMenus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadMenus = async () => {
    try {
      setErrorMessage('');
      setMenus(await getSavedMenus());
    } catch {
      setErrorMessage('저장한 메뉴를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getSavedMenus()
      .then((result) => {
        if (active) setMenus(result);
      })
      .catch(() => {
        if (active) setErrorMessage('저장한 메뉴를 불러오지 못했어요.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteSavedMenu(id);
      setMenus((current) => current.filter((menu) => menu.id !== id));
    } catch {
      setErrorMessage('메뉴 삭제에 실패했어요.');
    }
  };

  return (
    <section className="panel saved-menus-panel">
      <div className="panel-header">
        <div>
          <h2>저장한 메뉴</h2>
          <p className="panel-description">추천 결과에서 저장한 메뉴를 모아볼 수 있습니다.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={loadMenus}>새로고침</button>
      </div>

      {isLoading && <div className="empty-state">저장한 메뉴를 불러오는 중...</div>}
      {!isLoading && errorMessage && <p className="chat-error">{errorMessage}</p>}
      {!isLoading && !errorMessage && menus.length === 0 && (
        <div className="empty-state">아직 저장한 메뉴가 없습니다.</div>
      )}
      {!isLoading && !errorMessage && menus.length > 0 && (
        <div className="saved-menu-list">
          {menus.map((menu) => (
            <div className="saved-menu-item" key={menu.id}>
              <span>{menu.menu_name}</span>
              <button type="button" className="btn-secondary" onClick={() => onCook(menu)}>
                🍳 요리 완료
              </button>
              <button type="button" className="btn-delete" onClick={() => handleDelete(menu.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
