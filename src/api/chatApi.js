import axios from 'axios';

export async function sendChatMessage({ userId, message, ingredients }) {
  const response = await axios.post('/api/chat', {
    userId,
    message,
    ingredients,
  });

  return response.data;
}

export async function requestRecommendations({ userId, answers, ingredients }) {
  const response = await axios.post('/api/recommendations', {
    userId,
    ...answers,
    ingredients,
  });

  return response.data;
}
