import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { createApiServer } from './app.js';

const databasePath = process.env.DATABASE_PATH || fileURLToPath(new URL('./data/refrigerator.sqlite', import.meta.url));
const port = Number(process.env.PORT || 3001);
const db = openDatabase(databasePath);

createApiServer({ db }).listen(port, '127.0.0.1', () => {
  console.log(`Refrigerator API: http://127.0.0.1:${port}/api/health`);
});
