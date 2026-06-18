import { SQLiteDatabase } from 'expo-sqlite';
import { Category, CategoryCreateInput, CategoryUpdateInput, TransactionType } from './types';

export async function getAllCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY is_default DESC, type ASC, id ASC'
  );
}

export async function getCategoriesByType(db: SQLiteDatabase, type: TransactionType): Promise<Category[]> {
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, id ASC',
    [type]
  );
}

export async function getCategoryById(db: SQLiteDatabase, id: number): Promise<Category | null> {
  return db.getFirstAsync<Category>(
    'SELECT * FROM categories WHERE id = ?',
    [id]
  );
}

export async function getCategoryByName(db: SQLiteDatabase, name: string): Promise<Category | null> {
  return db.getFirstAsync<Category>(
    'SELECT * FROM categories WHERE name = ?',
    [name]
  );
}

export async function getDefaultCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE is_default = 1 ORDER BY type ASC, id ASC'
  );
}

export async function getCustomCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE is_default = 0 ORDER BY id ASC'
  );
}

export async function getCustomCategoriesByType(db: SQLiteDatabase, type: TransactionType): Promise<Category[]> {
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE is_default = 0 AND type = ? ORDER BY id ASC',
    [type]
  );
}

export async function insertCategory(db: SQLiteDatabase, input: CategoryCreateInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon, color, type, is_default) VALUES (?, ?, ?, ?, ?)',
    [input.name, input.icon, input.color, input.type, input.is_default ?? 0]
  );
  return result.lastInsertRowId;
}

export async function updateCategory(db: SQLiteDatabase, id: number, input: CategoryUpdateInput): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name);
  }
  if (input.icon !== undefined) {
    fields.push('icon = ?');
    values.push(input.icon);
  }
  if (input.color !== undefined) {
    fields.push('color = ?');
    values.push(input.color);
  }
  if (input.type !== undefined) {
    fields.push('type = ?');
    values.push(input.type);
  }

  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

export async function isCategoryInUse(db: SQLiteDatabase, id: number): Promise<boolean> {
  // Check if any transactions reference this category
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
    [id]
  );
  return (result?.count ?? 0) > 0;
}

export async function getCategoryTransactionCount(db: SQLiteDatabase, id: number): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
    [id]
  );
  return result?.count ?? 0;
}

export async function isDefaultCategory(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.getFirstAsync<{ is_default: number }>(
    'SELECT is_default FROM categories WHERE id = ?',
    [id]
  );
  return (result?.is_default ?? 0) === 1;
}

export async function isCategoryNameUnique(db: SQLiteDatabase, name: string, excludeId?: number): Promise<boolean> {
  if (excludeId !== undefined) {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM categories WHERE name = ? AND id != ?',
      [name, excludeId]
    );
    return (result?.count ?? 0) === 0;
  }
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories WHERE name = ?',
    [name]
  );
  return (result?.count ?? 0) === 0;
}
