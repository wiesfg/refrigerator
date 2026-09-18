import { useState } from 'react';
import { requestRecommendations } from '../api/chatApi';

const QUESTIONS = [
  {
    key: 'religiousAnswer',
    text: '종교적인 이유로 피하는 음식이나 식사 기준이 있나요?',
    placeholder: '예: 돼지고기는 먹지 않아요 / 없어요',
  },
  {
    key: 'vegetarianAnswer',
    text: '채식주의자인가요? 해당한다면 어떤 유형인가요?',
    placeholder: '예: 채식주의자는 아니에요 / 비건이에요',
  },
  {
    key: 'cuisineAnswer',
    text: '지금 어떤 종류의 음식이 끌리나요?',
    placeholder: '예: 매콤한 한식이 먹고 싶어요',
  },
];

const INITIAL_MESSAGES = [
  { id: 1, role: 'assistant', text: QUESTIONS[0].text },
];

export default function ChatPanel({ ingredients }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [userId, setUserId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedMenus, setSelectedMenus] = useState({});
  const [confirmedMenus, setConfirmedMenus] = useState({});

  const toggleMenu = (messageId, menuName) => {
    setSelectedMenus((current) => {
      const selected = current[messageId] ?? [];
      const next = selected.includes(menuName)
        ? selected.filter((name) => name !== menuName)
        : [...selected, menuName];
      return { ...current, [messageId]: next };
    });
  };

  const confirmMenus = (message) => {
    const selected = selectedMenus[message.id] ?? [];
    if (selected.length === 0 || confirmedMenus[message.id]) return;

    setConfirmedMenus((current) => ({ ...current, [message.id]: true }));
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', text: `선택한 메뉴: ${selected.join(', ')}` },
      { id: Date.now() + 1, role: 'assistant', text: '선택한 메뉴를 확인했어요. 맛있게 드세요!' },
    ]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isSending) return;

    const question = QUESTIONS[questionIndex];
    const nextAnswers = { ...answers, [question.key]: trimmedInput };
    const nextMessages = [
      ...messages,
      { id: Date.now(), role: 'user', text: trimmedInput },
    ];

    setAnswers(nextAnswers);
    setInput('');
    setErrorMessage('');

    if (questionIndex < QUESTIONS.length - 1) {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      setMessages([
        ...nextMessages,
        { id: Date.now() + 1, role: 'assistant', text: QUESTIONS[nextIndex].text },
      ]);
      return;
    }

    setMessages(nextMessages);
    setIsSending(true);

    try {
      const result = await requestRecommendations({
        userId,
        answers: nextAnswers,
        ingredients,
      });

      setUserId(result.userId ?? userId);
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: 'assistant', options: result.options ?? [] },
      ]);
      setQuestionIndex(QUESTIONS.length);
    } catch (error) {
      setErrorMessage(error.response?.status === 409
        ? '냉장고에 소비기한이 지나지 않은 재료를 먼저 등록해 주세요.'
        : '추천을 가져오지 못했어요. Spring Boot 서버가 실행 중인지 확인해 주세요.');
    } finally {
      setIsSending(false);
    }
  };

  const currentQuestion = QUESTIONS[questionIndex];

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <h2>AI 메뉴 상담</h2>
          <p className="panel-description">세 가지 질문에 답하면 냉장고 재료로 메뉴 4개를 추천합니다.</p>
        </div>
      </div>

      <div className="chat-ingredient-row">
        {ingredients.length === 0 ? (
          <span className="chat-ingredient-empty">등록된 재료가 없습니다.</span>
        ) : (
          ingredients.map((ingredient) => (
            <span key={ingredient} className="chat-ingredient-chip">{ingredient}</span>
          ))
        )}
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble ${message.role}`}>
            {message.options ? (
              <div className="chat-menu-options">
                <p>추천 메뉴</p>
                <div className="chat-menu-checkboxes">
                  {message.options.map((option) => (
                    <label key={option.menu_name}>
                      <input
                        type="checkbox"
                        checked={(selectedMenus[message.id] ?? []).includes(option.menu_name)}
                        disabled={confirmedMenus[message.id]}
                        onChange={() => toggleMenu(message.id, option.menu_name)}
                      />
                      <span>{option.menu_name}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-primary menu-confirm-button"
                  disabled={confirmedMenus[message.id] || !(selectedMenus[message.id] ?? []).length}
                  onClick={() => confirmMenus(message)}
                >
                  {confirmedMenus[message.id] ? '선택 완료' : '선택한 메뉴 확인'}
                </button>
              </div>
            ) : (
              message.text.split('\n').map((line, index) => (
                <span key={`${line}-${index}`}>{line}</span>
              ))
            )}
          </div>
        ))}
        {isSending && (
          <div className="chat-bubble assistant"><span>냉장고 재료를 확인하는 중...</span></div>
        )}
      </div>

      {errorMessage && <p className="chat-error">{errorMessage}</p>}

      {currentQuestion && (
        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={currentQuestion.placeholder}
            disabled={isSending}
            aria-label={currentQuestion.text}
          />
          <button type="submit" className="btn-primary" disabled={isSending || !input.trim()}>
            전송
          </button>
        </form>
      )}
    </section>
  );
}
