import { SQLiteDatabase } from 'expo-sqlite';
import {
  Transaction,
  TransactionCreateInput,
  TransactionUpdateInput,
  MonthlyTotals,
  CategoryExpenseTotal,
  TransactionType,
} from './types';

export async function insertTransaction(
  db: SQLiteDatabase,
  input: TransactionCreateInput
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO transactions (amount, type, category_id, description, date) VALUES (?, ?, ?, ?, ?)',
    [input.amount, input.type, input.category_id, input.description ?? '', input.date]
  );
  return result.lastInsertRowId;
}

export async function getTransactionById(
  db: SQLiteDatabase,
  id: number
): Promise<Transaction | null> {
  return db.getFirstAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.id = ?`,
    [id]
  );
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: number,
  input: TransactionUpdateInput
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.amount !== undefined) {
    fields.push('amount = ?');
    values.push(input.amount);
  }
  if (input.type !== undefined) {
    fields.push('type = ?');
    values.push(input.type);
  }
  if (input.category_id !== undefined) {
    fields.push('category_id = ?');
    values.push(input.category_id);
  }
  if (input.description !== undefined) {
    fields.push('description = ?');
    values.push(input.description);
  }
  if (input.date !== undefined) {
    fields.push('date = ?');
    values.push(input.date);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  await db.runAsync(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTransaction(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function getTransactionsByMonth(
  db: SQLiteDatabase,
  month: string // YYYY-MM format
): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.date LIKE ?
     ORDER BY t.date DESC, t.id DESC`,
    [`${month}%`]
  );
}

export async function getTransactionsByMonthAndType(
  db: SQLiteDatabase,
  month: string,
  type: TransactionType
): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.date LIKE ? AND t.type = ?
     ORDER BY t.date DESC, t.id DESC`,
    [`${month}%`, type]
  );
}

export async function getMonthlyTotals(
  db: SQLiteDatabase,
  month: string
): Promise<MonthlyTotals> {
  const result = await db.getFirstAsync<{ income: number | null; expense: number | null }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
    FROM transactions
    WHERE date LIKE ?`,
    [`${month}%`]
  );
  return {
    income: result?.income ?? 0,
    expense: result?.expense ?? 0,
  };
}

export async function getMonthlyTotalByType(
  db: SQLiteDatabase,
  month: string,
  type: TransactionType
): Promise<number> {
  const result = await db.getFirstAsync<{ total: number | null }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date LIKE ? AND type = ?',
    [`${month}%`, type]
  );
  return result?.total ?? 0;
}

export async function getMonthlyExpenseByCategory(
  db: SQLiteDatabase,
  month: string
): Promise<CategoryExpenseTotal[]> {
  return db.getAllAsync<CategoryExpenseTotal>(
    `SELECT
      t.category_id,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.date LIKE ? AND t.type = 'expense'
    GROUP BY t.category_id
    ORDER BY total DESC`,
    [`${month}%`]
  );
}

export async function getTransactionsByCategoryId(
  db: SQLiteDatabase,
  categoryId: number
): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.category_id = ?
     ORDER BY t.date DESC, t.id DESC`,
    [categoryId]
  );
}

export async function getTransactionCountByCategory(
  db: SQLiteDatabase,
  categoryId: number
): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
    [categoryId]
  );
  return result?.count ?? 0;
}
