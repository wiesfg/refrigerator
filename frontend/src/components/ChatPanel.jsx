import { useEffect, useRef, useState } from 'react';
import { requestRecommendations, requestMenuRecipe, saveMenu } from '../api/chatApi';

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
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const [retryRequest, setRetryRequest] = useState(null);
  const busyRef = useRef(false);
  const messageListRef = useRef(null);
  const busy = isSending || isSavingSelection;

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, errorMessage]);

  const toggleMenu = (messageId, menuName) => {
    setSelectedMenus((current) => {
      const selected = current[messageId] ?? [];
      const next = selected.includes(menuName)
        ? selected.filter((name) => name !== menuName)
        : [menuName];
      return { ...current, [messageId]: next };
    });
  };

  const confirmMenus = async (message) => {
    const selected = selectedMenus[message.id] ?? [];
    if (selected.length !== 1 || confirmedMenus[message.id] || busyRef.current) return;

    busyRef.current = true;
    setIsSavingSelection(true);
    setErrorMessage('');
    setRetryRequest(null);
    let saved = false;
    try {
      const menuName = selected[0];
      await saveMenu({ userId, menuName });
      saved = true;
      const recipe = await requestMenuRecipe({ userId, menuName, ingredients, message: followUps.join('\n') });
      setConfirmedMenus((current) => ({ ...current, [message.id]: true }));
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'user', text: `선택한 메뉴: ${menuName}` },
        { id: crypto.randomUUID(), role: 'assistant', recipe },
      ]);
    } catch {
      setErrorMessage(saved
        ? '메뉴는 저장됐지만 조리법을 가져오지 못했어요. 전북대 LLM 연결을 확인하고 같은 메뉴의 버튼을 다시 눌러 주세요.'
        : '메뉴 저장에 실패했어요. 잠시 후 다시 눌러 주세요.');
    } finally {
      busyRef.current = false;
      setIsSavingSelection(false);
    }
  };

  const recommend = async (payload) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsSending(true);
    setErrorMessage('');
    setRetryRequest(null);
    try {
      const result = await requestRecommendations(payload);
      if (!Array.isArray(result.options) || result.options.length !== 4) throw new Error('Invalid menu options');
      setUserId(result.user_id ?? result.userId ?? userId);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', options: result.options,
      }]);
    } catch (error) {
      setRetryRequest(payload);
      setErrorMessage(error.response?.status === 409
        ? '냉장고에 소비기한이 지나지 않은 재료를 먼저 등록해 주세요.'
        : '새 메뉴를 가져오지 못했어요. 전북대 LLM 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      busyRef.current = false;
      setIsSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || busyRef.current) return;

    const question = QUESTIONS[questionIndex];
    const nextAnswers = question ? { ...answers, [question.key]: trimmedInput } : answers;
    const nextMessages = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user', text: trimmedInput },
    ];

    setAnswers(nextAnswers);
    setInput('');
    setErrorMessage('');

    if (questionIndex < QUESTIONS.length - 1) {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      setMessages([
        ...nextMessages,
        { id: crypto.randomUUID(), role: 'assistant', text: QUESTIONS[nextIndex].text },
      ]);
      return;
    }

    setMessages(nextMessages);
    setQuestionIndex(QUESTIONS.length);
    const nextFollowUps = question ? followUps : [...followUps, trimmedInput];
    setFollowUps(nextFollowUps);
    await recommend({
      userId, answers: nextAnswers, ingredients,
      message: nextFollowUps.join('\n'),
      excludedMenus: messages.flatMap((entry) => entry.options?.map((option) => option.menu_name) ?? []),
    });
  };

  const currentQuestion = QUESTIONS[questionIndex];

  return (
    <section className="panel chat-panel">
      <div className="chat-hero-brand">
        <img src="/refrigerator-mascot.png" alt="냉장고 메뉴 추천 도우미" />
      </div>
      <h2 className="chat-hero-title">오늘은 어떤 메뉴가<br /><span>끌리시나요?</span></h2>
      <p className="chat-hero-description">세 가지 질문에 답하면 냉장고 재료로 메뉴 4개를 추천해드릴게요.</p>

      <div className="chat-ingredient-row">
        {ingredients.length === 0 ? (
          <span className="chat-ingredient-empty">등록된 재료가 없습니다.</span>
        ) : (
          ingredients.map((ingredient) => (
            <span key={ingredient} className="chat-ingredient-chip">{ingredient}</span>
          ))
        )}
      </div>

      <div className="chat-messages" aria-live="polite" ref={messageListRef}>
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble ${message.role}`}>
            {message.options ? (
              <div className="chat-menu-options">
                <p>추천 메뉴 · 하나를 선택해 주세요</p>
                <div className="chat-menu-checkboxes">
                  {message.options.map((option) => (
                    <label key={option.menu_name}>
                      <input
                        type="checkbox"
                        checked={(selectedMenus[message.id] ?? []).includes(option.menu_name)}
                        disabled={Boolean(confirmedMenus[message.id]) || busy}
                        onChange={() => toggleMenu(message.id, option.menu_name)}
                      />
                      <span>{option.menu_name}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-primary menu-confirm-button"
                  disabled={confirmedMenus[message.id]
                    || busy
                    || !(selectedMenus[message.id] ?? []).length}
                  onClick={() => confirmMenus(message)}
                >
                  {confirmedMenus[message.id]
                    ? '저장 완료'
                    : isSavingSelection ? '조리법을 가져오는 중...' : '나의 메뉴에 저장하고 조리법 보기'}
                </button>
              </div>
            ) : message.recipe ? (
              <div className="chat-recipe">
                <strong>{message.recipe.menu_name} · 상세 조리법</strong>
                <ol>{message.recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                <p>나의 메뉴에 저장했어요. 다른 메뉴 4개도 다시 요청할 수 있어요.</p>
              </div>
            ) : (
              message.text.split('\n').map((line, index) => (
                <span key={`${line}-${index}`}>{line}</span>
              ))
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-bubble assistant"><span>{isSending ? '다른 메뉴를 고르는 중...' : '선택한 메뉴의 조리법을 준비하는 중...'}</span></div>
        )}
      </div>

      {errorMessage && <p className="chat-error">{errorMessage}</p>}
      {retryRequest && <button type="button" className="btn-secondary" disabled={busy}
        onClick={() => recommend({ ...retryRequest, ingredients })}>추천 다시 시도</button>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={currentQuestion?.placeholder ?? '예: 다른 메뉴 4개 추천해줘 / 이번에는 국물 요리로'}
            disabled={busy}
            aria-label={currentQuestion?.text ?? '추가 메뉴 추천 요청'}
          />
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
            전송
          </button>
        </form>
    </section>
  );
}
