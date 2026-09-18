import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      unit TEXT NOT NULL,
      location TEXT NOT NULL,
      expiry TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      calorie TEXT,
      image_url TEXT,
      ingredients_json TEXT NOT NULL,
      manual_json TEXT NOT NULL
    );
  `);
  return db;
}

export function listItems(db) {
  return db.prepare('SELECT id, name, amount, unit, location, expiry FROM items ORDER BY expiry, id').all();
}

export function getItem(db, id) {
  return db.prepare('SELECT id, name, amount, unit, location, expiry FROM items WHERE id = ?').get(id);
}

export function addItem(db, item) {
  const result = db.prepare('INSERT INTO items (name, amount, unit, location, expiry) VALUES (?, ?, ?, ?, ?)')
    .run(item.name, item.amount, item.unit, item.location, item.expiry);
  return getItem(db, Number(result.lastInsertRowid));
}

export function updateItem(db, id, item) {
  db.prepare('UPDATE items SET name = ?, amount = ?, unit = ?, location = ?, expiry = ? WHERE id = ?')
    .run(item.name, item.amount, item.unit, item.location, item.expiry, id);
  return getItem(db, id);
}

export function listRecipes(db) {
  return db.prepare('SELECT * FROM recipes ORDER BY rowid').all().map(toRecipe);
}

export function getRecipe(db, id) {
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  return row ? toRecipe(row) : undefined;
}

export function addRecipe(db, recipe) {
  db.prepare('INSERT INTO recipes (id, name, description, calorie, image_url, ingredients_json, manual_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(recipe.id, recipe.name, recipe.description ?? null, recipe.calorie ?? null,
      recipe.imageUrl ?? null, JSON.stringify(recipe.ingredients), JSON.stringify(recipe.manual));
  return getRecipe(db, recipe.id);
}

function toRecipe(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    calorie: row.calorie,
    imageUrl: row.image_url,
    ingredients: JSON.parse(row.ingredients_json),
    manual: JSON.parse(row.manual_json),
  };
}

// Either every ingredient is deducted or none is. Batches of the same food are
// consumed in expiry order so the oldest stock is used first.
export function cookRecipe(db, recipe) {
  const required = new Map();
  for (const ingredient of recipe.ingredients) {
    const key = `${ingredient.name}\0${ingredient.unit}`;
    required.set(key, (required.get(key) ?? 0) + ingredient.amount);
  }

  const deductions = [];
  const missing = [];
  for (const [key, amount] of required) {
    const [name, unit] = key.split('\0');
    const batches = db.prepare('SELECT id, amount FROM items WHERE name = ? AND unit = ? ORDER BY expiry, id').all(name, unit);
    let remaining = amount;
    for (const batch of batches) {
      const used = Math.min(remaining, batch.amount);
      if (used > 0) deductions.push({ id: batch.id, used, remaining: batch.amount - used });
      remaining -= used;
      if (remaining <= 0) break;
    }
    if (remaining > 0) missing.push({ name, unit, amount: remaining });
  }
  if (missing.length) return { ok: false, missing };

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const deduction of deductions) {
      if (deduction.remaining <= 0) db.prepare('DELETE FROM items WHERE id = ?').run(deduction.id);
      else db.prepare('UPDATE items SET amount = ? WHERE id = ?').run(deduction.remaining, deduction.id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { ok: true, items: listItems(db) };
}
