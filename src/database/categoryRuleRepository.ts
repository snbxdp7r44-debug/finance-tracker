import { SQLiteDatabase } from 'expo-sqlite';
import { CategoryRule, CategoryRuleCreateInput, CategoryRuleUpdateInput } from './types';

export async function getAllRules(db: SQLiteDatabase): Promise<CategoryRule[]> {
  return db.getAllAsync<CategoryRule>(
    'SELECT * FROM category_rules ORDER BY priority DESC, id ASC'
  );
}

export async function getRulesByCategoryId(db: SQLiteDatabase, categoryId: number): Promise<CategoryRule[]> {
  return db.getAllAsync<CategoryRule>(
    'SELECT * FROM category_rules WHERE category_id = ? ORDER BY priority DESC, id ASC',
    [categoryId]
  );
}

export async function getRuleById(db: SQLiteDatabase, id: number): Promise<CategoryRule | null> {
  return db.getFirstAsync<CategoryRule>(
    'SELECT * FROM category_rules WHERE id = ?',
    [id]
  );
}

export async function getRuleByKeyword(db: SQLiteDatabase, keyword: string): Promise<CategoryRule | null> {
  return db.getFirstAsync<CategoryRule>(
    'SELECT * FROM category_rules WHERE keyword = ? ORDER BY priority DESC LIMIT 1',
    [keyword]
  );
}

export async function insertRule(db: SQLiteDatabase, input: CategoryRuleCreateInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)',
    [input.category_id, input.keyword, input.priority ?? 0]
  );
  return result.lastInsertRowId;
}

export async function updateRule(db: SQLiteDatabase, id: number, input: CategoryRuleUpdateInput): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.category_id !== undefined) {
    fields.push('category_id = ?');
    values.push(input.category_id);
  }
  if (input.keyword !== undefined) {
    fields.push('keyword = ?');
    values.push(input.keyword);
  }
  if (input.priority !== undefined) {
    fields.push('priority = ?');
    values.push(input.priority);
  }

  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE category_rules SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteRule(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM category_rules WHERE id = ?', [id]);
}

export async function deleteRulesByCategoryId(db: SQLiteDatabase, categoryId: number): Promise<void> {
  await db.runAsync('DELETE FROM category_rules WHERE category_id = ?', [categoryId]);
}

export async function findMatchingRules(db: SQLiteDatabase, note: string): Promise<(CategoryRule & { category_name: string; category_icon: string; category_color: string; category_type: string })[]> {
  // Get all rules and filter in JS for substring matching (SQLite LIKE doesn't support CJK well)
  const rules = await db.getAllAsync<CategoryRule & { category_name: string; category_icon: string; category_color: string; category_type: string }>(
    `SELECT cr.*, c.name as category_name, c.icon as category_icon, c.color as category_color, c.type as category_type
     FROM category_rules cr
     JOIN categories c ON cr.category_id = c.id
     ORDER BY cr.priority DESC`
  );

  return rules.filter(rule => note.includes(rule.keyword));
}

export async function isKeywordUniqueForCategory(db: SQLiteDatabase, keyword: string, categoryId: number, excludeId?: number): Promise<boolean> {
  if (excludeId !== undefined) {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM category_rules WHERE keyword = ? AND category_id = ? AND id != ?',
      [keyword, categoryId, excludeId]
    );
    return (result?.count ?? 0) === 0;
  }
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM category_rules WHERE keyword = ? AND category_id = ?',
    [keyword, categoryId]
  );
  return (result?.count ?? 0) === 0;
}
