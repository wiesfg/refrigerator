import axios from 'axios';

export async function sendChatMessage({ userId, message, ingredients }) {
  const response = await axios.post('/api/chat', {
    userId,
    message,
    ingredients,
  });

  return response.data;
}

export async function requestRecommendations({ userId, answers, ingredients, message, excludedMenus }) {
  const response = await axios.post('/api/recommendations', {
    userId,
    ...answers,
    ingredients,
    message,
    excludedMenus,
  });

  return response.data;
}

export async function requestMenuRecipe({ userId, menuName, ingredients, message }) {
  const response = await axios.post('/api/recommendations/recipe', { userId, menuName, ingredients, message });
  return response.data;
}

export async function saveMenu({ userId, menuName }) {
  const response = await axios.post('/api/saved-menus', { userId, menuName });
  return response.data;
}

export async function getSavedMenus() {
  const response = await axios.get('/api/saved-menus');
  return response.data;
}

export async function deleteSavedMenu(id) {
  await axios.delete(`/api/saved-menus/${id}`);
}

export async function getInventory() {
  const response = await axios.get('/api/inventory');
  return response.data;
}

export async function createInventoryItem(item) {
  const response = await axios.post('/api/inventory', item);
  return response.data;
}

export async function updateInventoryItem(id, patch) {
  const response = await axios.patch(`/api/inventory/${id}`, patch);
  return response.data;
}

export async function deleteInventoryItem(id) {
  await axios.delete(`/api/inventory/${id}`);
}

export async function cookSavedMenu(id, payload) {
  await axios.post(`/api/saved-menus/${id}/cook`, payload);
}

export async function cookInventory(payload) {
  await axios.post('/api/inventory/cook', payload);
}
