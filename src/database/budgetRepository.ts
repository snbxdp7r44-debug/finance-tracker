import { SQLiteDatabase } from 'expo-sqlite';
import {
  Budget,
  BudgetCreateInput,
  BudgetUpdateInput,
  BudgetStatus,
} from './types';
import {
  getMonthlyTotals,
  getMonthlyExpenseByCategory,
} from './transactionRepository';

// Helper: compute previous month string (YYYY-MM)
function getPrevMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  if (m === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(m - 1).padStart(2, '0')}`;
}

// Helper: build WHERE clause for month + category_id (handles NULL)
function monthCategoryWhere(categoryId: number | null): string {
  if (categoryId === null) {
    return 'month = ? AND category_id IS NULL';
  }
  return 'month = ? AND category_id = ?';
}

function monthCategoryParams(month: string, categoryId: number | null): (string | number)[] {
  if (categoryId === null) {
    return [month];
  }
  return [month, categoryId];
}

export async function insertBudget(
  db: SQLiteDatabase,
  input: BudgetCreateInput
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO budgets (month, category_id, amount, rollover_enabled, rollover_amount)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.month,
      input.category_id ?? null,
      input.amount,
      input.rollover_enabled ?? 0,
      input.rollover_amount ?? 0,
    ]
  );
  return result.lastInsertRowId;
}

export async function getBudgetById(
  db: SQLiteDatabase,
  id: number
): Promise<Budget | null> {
  return db.getFirstAsync<Budget>(
    'SELECT * FROM budgets WHERE id = ?',
    [id]
  );
}

export async function getBudgetForMonthCategory(
  db: SQLiteDatabase,
  month: string,
  categoryId: number | null
): Promise<Budget | null> {
  const where = monthCategoryWhere(categoryId);
  const params = monthCategoryParams(month, categoryId);
  return db.getFirstAsync<Budget>(
    `SELECT * FROM budgets WHERE ${where}`,
    params
  );
}

export async function getBudgetsByMonth(
  db: SQLiteDatabase,
  month: string
): Promise<Budget[]> {
  return db.getAllAsync<Budget>(
    'SELECT * FROM budgets WHERE month = ? ORDER BY id ASC',
    [month]
  );
}

export async function updateBudget(
  db: SQLiteDatabase,
  id: number,
  input: BudgetUpdateInput
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.amount !== undefined) {
    fields.push('amount = ?');
    values.push(input.amount);
  }
  if (input.rollover_enabled !== undefined) {
    fields.push('rollover_enabled = ?');
    values.push(input.rollover_enabled);
  }
  if (input.rollover_amount !== undefined) {
    fields.push('rollover_amount = ?');
    values.push(input.rollover_amount);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await db.runAsync(
    `UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteBudget(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
}

/**
 * Compute rollover amount for a given month and category from the previous month.
 * Returns 0 if rollover is not enabled for this budget or if no previous budget exists.
 * No negative rollover: if previous month was over budget, returns 0.
 */
export async function computeRollover(
  db: SQLiteDatabase,
  month: string,
  categoryId: number | null,
  rolloverEnabled: number
): Promise<number> {
  if (!rolloverEnabled) return 0;

  const prevMonth = getPrevMonth(month);
  const prevBudget = await getBudgetForMonthCategory(db, prevMonth, categoryId);

  if (!prevBudget || !prevBudget.rollover_enabled) return 0;

  // Compute previous month spending
  let prevSpending: number;
  if (categoryId === null) {
    // Total budget: sum all expenses
    const totals = await getMonthlyTotals(db, prevMonth);
    prevSpending = totals.expense;
  } else {
    // Per-category budget
    const expenses = await getMonthlyExpenseByCategory(db, prevMonth);
    prevSpending = expenses.find((c) => c.category_id === categoryId)?.total ?? 0;
  }

  // Previous effective budget: amount + stored rollover_amount
  const prevEffective = prevBudget.amount + prevBudget.rollover_amount;
  const unused = Math.max(0, prevEffective - prevSpending);
  return unused;
}

/**
 * Calculate budget status for all budgets in a given month.
 * Includes spending comparison and rollover computation.
 */
export async function calculateBudgetStatus(
  db: SQLiteDatabase,
  month: string
): Promise<BudgetStatus[]> {
  const budgets = await getBudgetsByMonth(db, month);
  if (budgets.length === 0) return [];

  const [categoryExpenses, monthlyTotals] = await Promise.all([
    getMonthlyExpenseByCategory(db, month),
    getMonthlyTotals(db, month),
  ]);

  const statuses = await Promise.all(
    budgets.map(async (budget) => {
      let spending: number;
      if (budget.category_id === null) {
        // Total budget: use total expense
        spending = monthlyTotals.expense;
      } else {
        // Per-category
        spending =
          categoryExpenses.find((c) => c.category_id === budget.category_id)
            ?.total ?? 0;
      }

      const rolloverFromPrevious = await computeRollover(
        db,
        month,
        budget.category_id,
        budget.rollover_enabled
      );

      const effectiveBudget = budget.amount + rolloverFromPrevious;
      const percentage =
        effectiveBudget > 0 ? (spending / effectiveBudget) * 100 : 0;
      const isOverBudget = spending >= effectiveBudget;

      return {
        budget,
        spending,
        effectiveBudget,
        percentage,
        isOverBudget,
        rolloverFromPrevious,
      };
    })
  );

  return statuses;
}
