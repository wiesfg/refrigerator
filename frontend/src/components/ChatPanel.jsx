import { useState } from 'react';
import { sendChatMessage } from '../api/chatApi';
import MenuCard from './MenuCard';

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'assistant',
    text: '먹고 싶은 스타일이나 피하고 싶은 재료를 말해줘. 지금 냉장고 재료를 같이 보고 메뉴만 추천해줄게.',
  },
];

export default function ChatPanel({ ingredients }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isSending) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: trimmedInput,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);
    setErrorMessage('');

    try {
      const result = await sendChatMessage({
        userId,
        message: trimmedInput,
        ingredients,
      });

      setUserId(result.userId);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'assistant',
          recommendation: {
            menuName: result.menu_name,
            reason: result.reason,
          },
        },
      ]);
    } catch {
      setErrorMessage('추천을 가져오지 못했어요. Spring Boot 서버가 실행 중인지 확인해 주세요.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <h2>AI 메뉴 상담</h2>
          <p className="panel-description">취향과 보유 재료를 바탕으로 메뉴명을 추천합니다.</p>
        </div>
      </div>

      <div className="chat-ingredient-row">
        {ingredients.length === 0 ? (
          <span className="chat-ingredient-empty">등록된 재료가 없습니다.</span>
        ) : (
          ingredients.map((ingredient) => (
            <span key={ingredient} className="chat-ingredient-chip">
              {ingredient}
            </span>
          ))
        )}
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-bubble ${message.role} ${message.recommendation ? 'with-menu-card' : ''}`}
          >
            {message.recommendation ? (
              <MenuCard
                menuName={message.recommendation.menuName}
                reason={message.recommendation.reason}
              />
            ) : (
              message.text.split('\n').map((line, index) => (
                <span key={`${line}-${index}`}>{line}</span>
              ))
            )}
          </div>
        ))}
        {isSending && (
          <div className="chat-bubble assistant">
            <span>메뉴를 고르는 중...</span>
          </div>
        )}
      </div>

      {errorMessage && <p className="chat-error">{errorMessage}</p>}

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="예: 다이어트 중이고 매운맛 좋아해"
          disabled={isSending}
        />
        <button type="submit" className="btn-primary" disabled={isSending || !input.trim()}>
          전송
        </button>
      </form>
    </section>
  );
}
