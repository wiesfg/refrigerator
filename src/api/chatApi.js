import axios from 'axios';

export async function sendChatMessage({ userId, message, ingredients }) {
  const response = await axios.post('/api/chat', {
    userId,
    message,
    ingredients,
  });

  return response.data;
}
