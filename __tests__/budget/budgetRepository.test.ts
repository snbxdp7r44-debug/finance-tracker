import {
  insertBudget,
  getBudgetById,
  getBudgetForMonthCategory,
  getBudgetsByMonth,
  updateBudget,
  deleteBudget,
  computeRollover,
  calculateBudgetStatus,
} from '../../src/database/budgetRepository';
import { Budget } from '../../src/database/types';

// Helper to create a mock db with in-memory budget storage
function createMockDb(initialTransactions?: any[]) {
  let budgets: Budget[] = [];
  let nextId = 1;
  const transactions = initialTransactions ?? [];

  return {
    _budgets: budgets,

    getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM budgets')) {
        if (sql.includes('WHERE month = ?')) {
          const month = params?.[0] ?? '';
          return budgets.filter((b) => b.month === month);
        }
        return budgets;
      }
      // getMonthlyExpenseByCategory
      if (sql.includes('GROUP BY t.category_id') || sql.includes('GROUP BY category_id')) {
        const monthPrefix = (params?.[0] ?? '').replace('%', '');
        const grouped: Record<number, { category_id: number; category_name: string; category_icon: string; category_color: string; total: number }> = {};
        for (const t of transactions) {
          if (t.date.startsWith(monthPrefix) && t.type === 'expense') {
            if (!grouped[t.category_id]) {
              grouped[t.category_id] = {
                category_id: t.category_id,
                category_name: `Category${t.category_id}`,
                category_icon: 'food',
                category_color: '#FF5722',
                total: 0,
              };
            }
            grouped[t.category_id].total += t.amount;
          }
        }
        return Object.values(grouped);
      }
      return [];
    }),

    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM budgets WHERE id = ?')) {
        const id = params?.[0];
        return budgets.find((b) => b.id === id) ?? null;
      }
      if (sql.includes('FROM budgets WHERE month = ? AND category_id IS NULL')) {
        const month = params?.[0];
        return budgets.find((b) => b.month === month && b.category_id === null) ?? null;
      }
      if (sql.includes('FROM budgets WHERE month = ? AND category_id = ?')) {
        const month = params?.[0];
        const catId = params?.[1];
        return budgets.find((b) => b.month === month && b.category_id === catId) ?? null;
      }
      // getMonthlyTotals
      if (sql.includes('COALESCE(SUM') && sql.includes('income') && sql.includes('expense')) {
        const monthPrefix = (params?.[0] ?? '').replace('%', '');
        const income = transactions
          .filter((t: any) => t.date.startsWith(monthPrefix) && t.type === 'income')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const expense = transactions
          .filter((t: any) => t.date.startsWith(monthPrefix) && t.type === 'expense')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        return { income, expense };
      }
      return null;
    }),

    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO budgets')) {
        const id = nextId++;
        const budget: Budget = {
          id,
          month: params?.[0] ?? '',
          category_id: params?.[1] ?? null,
          amount: params?.[2] ?? 0,
          rollover_enabled: params?.[3] ?? 0,
          rollover_amount: params?.[4] ?? 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        budgets.push(budget);
        return { lastInsertRowId: id };
      }
      if (sql.includes('UPDATE budgets SET')) {
        const id = params?.[params.length - 1];
        const idx = budgets.findIndex((b) => b.id === id);
        if (idx !== -1) {
          const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
          if (setMatch) {
            const setClauses = setMatch[1].split(',').map((s: string) => s.trim());
            let paramIdx = 0;
            for (const clause of setClauses) {
              const fieldMatch = clause.match(/(\w+)\s*=\s*\?/);
              if (fieldMatch) {
                const field = fieldMatch[1] as keyof Budget;
                if (field !== 'id') {
                  (budgets[idx] as any)[field] = params?.[paramIdx];
                }
                paramIdx++;
              }
            }
          }
          budgets[idx].updated_at = new Date().toISOString();
        }
        return {};
      }
      if (sql.includes('DELETE FROM budgets')) {
        const id = params?.[0];
        budgets = budgets.filter((b) => b.id !== id);
        return {};
      }
      return {};
    }),

    execAsync: jest.fn(async () => {}),
  } as any;
}

describe('budgetRepository', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('insertBudget', () => {
    it('should insert a total budget (category_id = null)', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
        rollover_enabled: 0,
      });
      expect(id).toBeGreaterThan(0);
      const budget = await getBudgetById(db, id);
      expect(budget).not.toBeNull();
      expect(budget?.month).toBe('2026-06');
      expect(budget?.category_id).toBeNull();
      expect(budget?.amount).toBe(3000);
      expect(budget?.rollover_enabled).toBe(0);
    });

    it('should insert a per-category budget', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: 1,
        amount: 500,
        rollover_enabled: 0,
      });
      const budget = await getBudgetById(db, id);
      expect(budget?.category_id).toBe(1);
      expect(budget?.amount).toBe(500);
    });

    it('should insert a budget with rollover enabled', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 2000,
        rollover_enabled: 1,
        rollover_amount: 200,
      });
      const budget = await getBudgetById(db, id);
      expect(budget?.rollover_enabled).toBe(1);
      expect(budget?.rollover_amount).toBe(200);
    });

    it('should default rollover fields to 0', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 1000,
      });
      const budget = await getBudgetById(db, id);
      expect(budget?.rollover_enabled).toBe(0);
      expect(budget?.rollover_amount).toBe(0);
    });
  });

  describe('getBudgetById', () => {
    it('should return null for non-existent id', async () => {
      const result = await getBudgetById(db, 999);
      expect(result).toBeNull();
    });

    it('should return budget with correct fields', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: 2,
        amount: 500,
      });
      const budget = await getBudgetById(db, id);
      expect(budget?.id).toBe(id);
      expect(budget?.month).toBe('2026-06');
      expect(budget?.category_id).toBe(2);
      expect(budget?.amount).toBe(500);
    });
  });

  describe('getBudgetForMonthCategory', () => {
    it('should find total budget by month and null category', async () => {
      await insertBudget(db, { month: '2026-06', category_id: null, amount: 3000 });
      const budget = await getBudgetForMonthCategory(db, '2026-06', null);
      expect(budget).not.toBeNull();
      expect(budget?.category_id).toBeNull();
      expect(budget?.amount).toBe(3000);
    });

    it('should find per-category budget by month and category_id', async () => {
      await insertBudget(db, { month: '2026-06', category_id: 1, amount: 500 });
      const budget = await getBudgetForMonthCategory(db, '2026-06', 1);
      expect(budget).not.toBeNull();
      expect(budget?.category_id).toBe(1);
    });

    it('should return null for non-existent combination', async () => {
      await insertBudget(db, { month: '2026-06', category_id: null, amount: 3000 });
      const budget = await getBudgetForMonthCategory(db, '2026-05', null);
      expect(budget).toBeNull();
    });
  });

  describe('getBudgetsByMonth', () => {
    it('should return all budgets for a month', async () => {
      await insertBudget(db, { month: '2026-06', category_id: null, amount: 3000 });
      await insertBudget(db, { month: '2026-06', category_id: 1, amount: 500 });
      await insertBudget(db, { month: '2026-05', category_id: null, amount: 2000 });
      const budgets = await getBudgetsByMonth(db, '2026-06');
      expect(budgets).toHaveLength(2);
    });

    it('should return empty array for month with no budgets', async () => {
      const budgets = await getBudgetsByMonth(db, '2025-01');
      expect(budgets).toHaveLength(0);
    });
  });

  describe('updateBudget', () => {
    it('should update budget amount', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
      });
      await updateBudget(db, id, { amount: 4000 });
      const budget = await getBudgetById(db, id);
      expect(budget?.amount).toBe(4000);
    });

    it('should update rollover_enabled', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
        rollover_enabled: 0,
      });
      await updateBudget(db, id, { rollover_enabled: 1 });
      const budget = await getBudgetById(db, id);
      expect(budget?.rollover_enabled).toBe(1);
    });

    it('should do nothing when no fields provided', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
      });
      await updateBudget(db, id, {});
      const budget = await getBudgetById(db, id);
      expect(budget?.amount).toBe(3000);
    });
  });

  describe('deleteBudget', () => {
    it('should delete a budget', async () => {
      const id = await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
      });
      await deleteBudget(db, id);
      const budget = await getBudgetById(db, id);
      expect(budget).toBeNull();
    });
  });

  describe('computeRollover', () => {
    it('should return 0 when rollover is disabled', async () => {
      const rollover = await computeRollover(db, '2026-06', null, 0);
      expect(rollover).toBe(0);
    });

    it('should return 0 when no previous budget exists', async () => {
      const rollover = await computeRollover(db, '2026-06', null, 1);
      expect(rollover).toBe(0);
    });

    it('should return 0 when previous budget has rollover disabled', async () => {
      await insertBudget(db, {
        month: '2026-05',
        category_id: null,
        amount: 2000,
        rollover_enabled: 0,
      });
      const rollover = await computeRollover(db, '2026-06', null, 1);
      expect(rollover).toBe(0);
    });

    it('should compute unused budget from previous month (total)', async () => {
      // Previous month budget = 2000, spending = 1200, unused = 800
      const dbWithTransactions = createMockDb([
        { amount: 1200, type: 'expense', category_id: 1, date: '2026-05-15' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2026-05',
        category_id: null,
        amount: 2000,
        rollover_enabled: 1,
        rollover_amount: 0,
      });
      const rollover = await computeRollover(dbWithTransactions, '2026-06', null, 1);
      expect(rollover).toBe(800);
    });

    it('should compute unused budget from previous month (per-category)', async () => {
      // Category 1: budget = 500, spending = 300, unused = 200
      const dbWithTransactions = createMockDb([
        { amount: 300, type: 'expense', category_id: 1, date: '2026-05-15' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2026-05',
        category_id: 1,
        amount: 500,
        rollover_enabled: 1,
        rollover_amount: 0,
      });
      const rollover = await computeRollover(dbWithTransactions, '2026-06', 1, 1);
      expect(rollover).toBe(200);
    });

    it('should not return negative rollover (overspent month)', async () => {
      // Previous month: budget = 1000, spending = 1500 (overspent)
      const dbWithTransactions = createMockDb([
        { amount: 1500, type: 'expense', category_id: 1, date: '2026-05-15' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2026-05',
        category_id: null,
        amount: 1000,
        rollover_enabled: 1,
        rollover_amount: 0,
      });
      const rollover = await computeRollover(dbWithTransactions, '2026-06', null, 1);
      expect(rollover).toBe(0);
    });

    it('should handle year boundary (Jan -> prev Dec)', async () => {
      // Compute rollover for 2026-01 -> looks at 2025-12
      const dbWithTransactions = createMockDb([
        { amount: 500, type: 'expense', category_id: 1, date: '2025-12-15' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2025-12',
        category_id: null,
        amount: 2000,
        rollover_enabled: 1,
        rollover_amount: 0,
      });
      const rollover = await computeRollover(dbWithTransactions, '2026-01', null, 1);
      expect(rollover).toBe(1500);
    });
  });

  describe('calculateBudgetStatus', () => {
    it('should return empty array when no budgets', async () => {
      const statuses = await calculateBudgetStatus(db, '2026-06');
      expect(statuses).toHaveLength(0);
    });

    it('should calculate status for total budget with no spending', async () => {
      await insertBudget(db, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
      });
      const statuses = await calculateBudgetStatus(db, '2026-06');
      expect(statuses).toHaveLength(1);
      expect(statuses[0].spending).toBe(0);
      expect(statuses[0].effectiveBudget).toBe(3000);
      expect(statuses[0].percentage).toBe(0);
      expect(statuses[0].isOverBudget).toBe(false);
    });

    it('should calculate spending correctly for total budget', async () => {
      const dbWithTransactions = createMockDb([
        { amount: 500, type: 'expense', category_id: 1, date: '2026-06-10' },
        { amount: 300, type: 'expense', category_id: 2, date: '2026-06-15' },
        { amount: 5000, type: 'income', category_id: 3, date: '2026-06-01' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
      });
      const statuses = await calculateBudgetStatus(dbWithTransactions, '2026-06');
      expect(statuses[0].spending).toBeCloseTo(800);
      expect(statuses[0].percentage).toBeCloseTo(800 / 3000 * 100);
    });

    it('should show isOverBudget when spending exceeds budget', async () => {
      const dbWithTransactions = createMockDb([
        { amount: 3500, type: 'expense', category_id: 1, date: '2026-06-10' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2026-06',
        category_id: null,
        amount: 3000,
      });
      const statuses = await calculateBudgetStatus(dbWithTransactions, '2026-06');
      expect(statuses[0].isOverBudget).toBe(true);
      expect(statuses[0].spending).toBe(3500);
    });

    it('should calculate per-category budget spending', async () => {
      const dbWithTransactions = createMockDb([
        { amount: 200, type: 'expense', category_id: 1, date: '2026-06-10' },
        { amount: 150, type: 'expense', category_id: 1, date: '2026-06-15' },
        { amount: 300, type: 'expense', category_id: 2, date: '2026-06-12' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2026-06',
        category_id: 1,
        amount: 500,
      });
      const statuses = await calculateBudgetStatus(dbWithTransactions, '2026-06');
      expect(statuses[0].spending).toBeCloseTo(350);
      expect(statuses[0].effectiveBudget).toBe(500);
      expect(statuses[0].percentage).toBeCloseTo(70);
    });

    it('should include rollover in effective budget', async () => {
      // Previous month budget: 2000, spending: 1200, rollover: 800
      const dbWithTransactions = createMockDb([
        { amount: 1200, type: 'expense', category_id: 1, date: '2026-05-15' },
        { amount: 500, type: 'expense', category_id: 1, date: '2026-06-10' },
      ]);
      await insertBudget(dbWithTransactions, {
        month: '2026-05',
        category_id: null,
        amount: 2000,
        rollover_enabled: 1,
        rollover_amount: 0,
      });
      await insertBudget(dbWithTransactions, {
        month: '2026-06',
        category_id: null,
        amount: 2000,
        rollover_enabled: 1,
        rollover_amount: 0,
      });
      const statuses = await calculateBudgetStatus(dbWithTransactions, '2026-06');
      expect(statuses[0].rolloverFromPrevious).toBe(800);
      expect(statuses[0].effectiveBudget).toBe(2800);
      expect(statuses[0].spending).toBe(500);
    });
  });
});
