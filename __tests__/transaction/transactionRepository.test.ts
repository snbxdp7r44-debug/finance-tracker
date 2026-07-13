import {
  insertTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionsByMonth,
  getMonthlyTotals,
  getMonthlyTotalByType,
  getMonthlyExpenseByCategory,
  getTransactionCountByCategory,
  getMonthlyTrend,
} from '../../src/database/transactionRepository';
import { Transaction, TransactionType } from '../../src/database/types';

// Helper to create a mock db with in-memory transaction storage
function createMockDb() {
  let transactions: Transaction[] = [];
  let nextId = 1;

  // Simple categories for join simulation
  const categories: Record<number, { name: string; icon: string; color: string }> = {
    1: { name: '餐饮', icon: 'food', color: '#FF5722' },
    2: { name: '交通', icon: 'car', color: '#2196F3' },
    3: { name: '工资', icon: 'cash', color: '#4CAF50' },
    4: { name: '购物', icon: 'cart', color: '#E91E63' },
  };

  const enrichTransaction = (t: Transaction): Transaction => {
    const cat = categories[t.category_id];
    return {
      ...t,
      category_name: cat?.name,
      category_icon: cat?.icon,
      category_color: cat?.color,
    };
  };

  return {
    _transactions: transactions,
    _setTransactions: (ts: Transaction[]) => {
      transactions = ts;
      nextId = ts.length > 0 ? Math.max(...ts.map(t => t.id)) + 1 : 1;
    },

    getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
      // Check for monthly trend query (GROUP BY substr(date, 1, 7))
      if (sql.includes("substr(date, 1, 7)") && sql.includes("GROUP BY")) {
        const limit = params?.[0] as number;
        const monthMap: Record<string, { income: number; expense: number }> = {};
        for (const t of transactions) {
          const month = t.date.substring(0, 7);
          if (!monthMap[month]) {
            monthMap[month] = { income: 0, expense: 0 };
          }
          if (t.type === 'income') {
            monthMap[month].income += t.amount;
          } else {
            monthMap[month].expense += t.amount;
          }
        }
        // Simulate SQL: ORDER BY month DESC LIMIT ? (getMonthlyTrend does .reverse() on result)
        return Object.entries(monthMap)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, limit)
          .map(([month, totals]) => ({ month, ...totals }));
      }
      // Check GROUP BY first (it also contains FROM transactions t)
      if (sql.includes('GROUP BY t.category_id')) {
        // Monthly expense by category
        const monthPrefix = (params?.[0] ?? '').replace('%', '');
        const expenseItems = transactions.filter(
          t => t.date.startsWith(monthPrefix) && t.type === 'expense'
        );
        const grouped: Record<number, { category_id: number; category_name: string; category_icon: string; category_color: string; total: number }> = {};
        for (const t of expenseItems) {
          if (!grouped[t.category_id]) {
            const cat = categories[t.category_id];
            grouped[t.category_id] = {
              category_id: t.category_id,
              category_name: cat?.name ?? '',
              category_icon: cat?.icon ?? '',
              category_color: cat?.color ?? '',
              total: 0,
            };
          }
          grouped[t.category_id].total += t.amount;
        }
        return Object.values(grouped).sort((a, b) => b.total - a.total);
      }
      if (sql.includes('FROM transactions t')) {
        // JOIN query for monthly transactions
        let filtered = [...transactions];
        if (sql.includes('t.date LIKE ?')) {
          const monthPrefix = params?.[0] ?? '';
          filtered = filtered.filter(t => t.date.startsWith(monthPrefix.replace('%', '')));
        }
        if (sql.includes('AND t.type = ?')) {
          const type = params?.[1] as TransactionType;
          filtered = filtered.filter(t => t.type === type);
        }
        // Sort by date DESC, id DESC
        filtered.sort((a, b) => {
          const dateComp = b.date.localeCompare(a.date);
          if (dateComp !== 0) return dateComp;
          return b.id - a.id;
        });
        return filtered.map(enrichTransaction);
      }
      return [];
    }),

    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM transactions t') && sql.includes('WHERE t.id = ?')) {
        const id = params?.[0];
        const t = transactions.find(t => t.id === id);
        return t ? enrichTransaction(t) : null;
      }
      if (sql.includes('COALESCE(SUM') && sql.includes('income') && sql.includes('expense')) {
        // Monthly totals
        const monthPrefix = (params?.[0] ?? '').replace('%', '');
        const monthItems = transactions.filter(t => t.date.startsWith(monthPrefix));
        const income = monthItems
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const expense = monthItems
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        return { income, expense };
      }
      if (sql.includes('COALESCE(SUM(amount)') && sql.includes('AND type = ?')) {
        // Monthly total by type
        const monthPrefix = (params?.[0] ?? '').replace('%', '');
        const type = params?.[1] as TransactionType;
        const total = transactions
          .filter(t => t.date.startsWith(monthPrefix) && t.type === type)
          .reduce((sum, t) => sum + t.amount, 0);
        return { total };
      }
      if (sql.includes('SELECT COUNT(*)') && sql.includes('FROM transactions')) {
        const catId = params?.[0];
        const count = transactions.filter(t => t.category_id === catId).length;
        return { count };
      }
      return null;
    }),

    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO transactions')) {
        const id = nextId++;
        const newTransaction: Transaction = {
          id,
          amount: params?.[0] ?? 0,
          type: params?.[1] ?? 'expense',
          category_id: params?.[2] ?? 0,
          description: params?.[3] ?? '',
          date: params?.[4] ?? '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        transactions.push(newTransaction);
        return { lastInsertRowId: id };
      }
      if (sql.includes('UPDATE transactions')) {
        const lastParam = params?.[params.length - 1]; // id
        const idx = transactions.findIndex(t => t.id === lastParam);
        if (idx !== -1) {
          // Parse SET fields
          const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
          if (setMatch) {
            const setClauses = setMatch[1].split(',').map(s => s.trim());
            let paramIdx = 0;
            for (const clause of setClauses) {
              const fieldMatch = clause.match(/(\w+)\s*=\s*\?/);
              if (fieldMatch) {
                const field = fieldMatch[1] as keyof Transaction;
                if (field !== 'id') {
                  (transactions[idx] as any)[field] = params?.[paramIdx];
                }
                paramIdx++;
              }
            }
          }
          transactions[idx].updated_at = new Date().toISOString();
        }
        return {};
      }
      if (sql.includes('DELETE FROM transactions')) {
        const id = params?.[0];
        transactions = transactions.filter(t => t.id !== id);
        return {};
      }
      if (sql.includes('PRAGMA user_version')) {
        return {};
      }
      return {};
    }),

    execAsync: jest.fn(async () => {}),

    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
      await task();
    }),
  } as any;
}

describe('transactionRepository', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('insertTransaction', () => {
    it('should insert a transaction and return its id', async () => {
      const id = await insertTransaction(db, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });
      expect(id).toBeGreaterThan(0);
      const transaction = await getTransactionById(db, id);
      expect(transaction).not.toBeNull();
      expect(transaction?.amount).toBe(35.5);
      expect(transaction?.type).toBe('expense');
      expect(transaction?.category_id).toBe(1);
      expect(transaction?.description).toBe('午餐');
      expect(transaction?.date).toBe('2026-06-15');
    });

    it('should insert an income transaction', async () => {
      const id = await insertTransaction(db, {
        amount: 5000,
        type: 'income',
        category_id: 3,
        description: '月薪',
        date: '2026-06-01',
      });
      const transaction = await getTransactionById(db, id);
      expect(transaction?.type).toBe('income');
      expect(transaction?.amount).toBe(5000);
    });

    it('should insert a transaction with empty description', async () => {
      const id = await insertTransaction(db, {
        amount: 100,
        type: 'expense',
        category_id: 1,
        description: '',
        date: '2026-06-15',
      });
      const transaction = await getTransactionById(db, id);
      expect(transaction?.description).toBe('');
    });

    it('should default description to empty string when not provided', async () => {
      const id = await insertTransaction(db, {
        amount: 50,
        type: 'expense',
        category_id: 2,
        date: '2026-06-15',
      });
      const transaction = await getTransactionById(db, id);
      expect(transaction?.description).toBe('');
    });
  });

  describe('getTransactionById', () => {
    it('should return a transaction with category info', async () => {
      const id = await insertTransaction(db, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });
      const transaction = await getTransactionById(db, id);
      expect(transaction?.category_name).toBe('餐饮');
      expect(transaction?.category_icon).toBe('food');
      expect(transaction?.category_color).toBe('#FF5722');
    });

    it('should return null for non-existent id', async () => {
      const result = await getTransactionById(db, 999);
      expect(result).toBeNull();
    });
  });

  describe('updateTransaction', () => {
    it('should update a transaction amount', async () => {
      const id = await insertTransaction(db, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });
      await updateTransaction(db, id, { amount: 40 });
      const transaction = await getTransactionById(db, id);
      expect(transaction?.amount).toBe(40);
    });

    it('should update description with special characters', async () => {
      const id = await insertTransaction(db, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });
      const specialDesc = '午餐@公司#1 — 咖啡 & 零食';
      await updateTransaction(db, id, { description: specialDesc });
      const transaction = await getTransactionById(db, id);
      expect(transaction?.description).toBe(specialDesc);
    });

    it('should do nothing when no fields provided', async () => {
      const id = await insertTransaction(db, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });
      await updateTransaction(db, id, {});
      const transaction = await getTransactionById(db, id);
      expect(transaction?.amount).toBe(35.5);
    });
  });

  describe('deleteTransaction', () => {
    it('should delete a transaction', async () => {
      const id = await insertTransaction(db, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });
      await deleteTransaction(db, id);
      const transaction = await getTransactionById(db, id);
      expect(transaction).toBeNull();
    });
  });

  describe('getTransactionsByMonth', () => {
    beforeEach(async () => {
      await insertTransaction(db, {
        amount: 35.5, type: 'expense', category_id: 1, description: '午餐', date: '2026-06-15',
      });
      await insertTransaction(db, {
        amount: 50, type: 'expense', category_id: 2, description: '地铁', date: '2026-06-16',
      });
      await insertTransaction(db, {
        amount: 5000, type: 'income', category_id: 3, description: '工资', date: '2026-06-01',
      });
      await insertTransaction(db, {
        amount: 100, type: 'expense', category_id: 1, description: '早餐', date: '2026-05-20',
      });
    });

    it('should return transactions for the specified month', async () => {
      const result = await getTransactionsByMonth(db, '2026-06');
      expect(result).toHaveLength(3);
    });

    it('should not return transactions from other months', async () => {
      const result = await getTransactionsByMonth(db, '2026-05');
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('早餐');
    });

    it('should return empty array for month with no transactions', async () => {
      const result = await getTransactionsByMonth(db, '2025-01');
      expect(result).toHaveLength(0);
    });

    it('should return transactions ordered by date descending', async () => {
      const result = await getTransactionsByMonth(db, '2026-06');
      expect(result[0].date).toBe('2026-06-16');
      expect(result[1].date).toBe('2026-06-15');
      expect(result[2].date).toBe('2026-06-01');
    });
  });

  describe('getMonthlyTotals', () => {
    beforeEach(async () => {
      await insertTransaction(db, {
        amount: 35.5, type: 'expense', category_id: 1, description: '午餐', date: '2026-06-15',
      });
      await insertTransaction(db, {
        amount: 50, type: 'expense', category_id: 2, description: '地铁', date: '2026-06-16',
      });
      await insertTransaction(db, {
        amount: 5000, type: 'income', category_id: 3, description: '工资', date: '2026-06-01',
      });
    });

    it('should return correct income and expense totals', async () => {
      const result = await getMonthlyTotals(db, '2026-06');
      expect(result.income).toBe(5000);
      expect(result.expense).toBeCloseTo(85.5);
    });

    it('should return zero totals for month with no transactions', async () => {
      const result = await getMonthlyTotals(db, '2025-01');
      expect(result.income).toBe(0);
      expect(result.expense).toBe(0);
    });

    it('should only count transactions for the specified month', async () => {
      await insertTransaction(db, {
        amount: 100, type: 'expense', category_id: 1, description: '早餐', date: '2026-05-20',
      });
      const result = await getMonthlyTotals(db, '2026-06');
      expect(result.expense).toBeCloseTo(85.5);
    });
  });

  describe('getMonthlyTotalByType', () => {
    it('should return total for income type', async () => {
      await insertTransaction(db, {
        amount: 5000, type: 'income', category_id: 3, description: '工资', date: '2026-06-01',
      });
      const result = await getMonthlyTotalByType(db, '2026-06', 'income');
      expect(result).toBe(5000);
    });

    it('should return total for expense type', async () => {
      await insertTransaction(db, {
        amount: 35.5, type: 'expense', category_id: 1, description: '午餐', date: '2026-06-15',
      });
      await insertTransaction(db, {
        amount: 50, type: 'expense', category_id: 2, description: '地铁', date: '2026-06-16',
      });
      const result = await getMonthlyTotalByType(db, '2026-06', 'expense');
      expect(result).toBeCloseTo(85.5);
    });
  });

  describe('getMonthlyExpenseByCategory', () => {
    beforeEach(async () => {
      await insertTransaction(db, {
        amount: 35.5, type: 'expense', category_id: 1, description: '午餐', date: '2026-06-15',
      });
      await insertTransaction(db, {
        amount: 20, type: 'expense', category_id: 1, description: '晚餐', date: '2026-06-16',
      });
      await insertTransaction(db, {
        amount: 50, type: 'expense', category_id: 2, description: '地铁', date: '2026-06-16',
      });
      await insertTransaction(db, {
        amount: 5000, type: 'income', category_id: 3, description: '工资', date: '2026-06-01',
      });
    });

    it('should group expenses by category', async () => {
      const result = await getMonthlyExpenseByCategory(db, '2026-06');
      expect(result).toHaveLength(2); // Only expense categories
    });

    it('should sum amounts within each category', async () => {
      const result = await getMonthlyExpenseByCategory(db, '2026-06');
      const foodCat = result.find(r => r.category_id === 1);
      expect(foodCat?.total).toBeCloseTo(55.5);
      const transportCat = result.find(r => r.category_id === 2);
      expect(transportCat?.total).toBe(50);
    });

    it('should not include income transactions', async () => {
      const result = await getMonthlyExpenseByCategory(db, '2026-06');
      const incomeCat = result.find(r => r.category_id === 3);
      expect(incomeCat).toBeUndefined();
    });

    it('should return results ordered by total descending', async () => {
      const result = await getMonthlyExpenseByCategory(db, '2026-06');
      expect(result[0].category_id).toBe(1); // 55.5 > 50
      expect(result[1].category_id).toBe(2);
    });
  });

  describe('getTransactionCountByCategory', () => {
    it('should return count of transactions for a category', async () => {
      await insertTransaction(db, {
        amount: 35.5, type: 'expense', category_id: 1, description: '午餐', date: '2026-06-15',
      });
      await insertTransaction(db, {
        amount: 20, type: 'expense', category_id: 1, description: '晚餐', date: '2026-06-16',
      });
      const count = await getTransactionCountByCategory(db, 1);
      expect(count).toBe(2);
    });

    it('should return 0 for category with no transactions', async () => {
      const count = await getTransactionCountByCategory(db, 999);
      expect(count).toBe(0);
    });
  });

  describe('getMonthlyTrend', () => {
    beforeEach(async () => {
      await insertTransaction(db, {
        amount: 35.5, type: 'expense', category_id: 1, description: '午餐', date: '2026-06-15',
      });
      await insertTransaction(db, {
        amount: 5000, type: 'income', category_id: 3, description: '工资', date: '2026-06-01',
      });
      await insertTransaction(db, {
        amount: 100, type: 'expense', category_id: 1, description: '早餐', date: '2026-05-20',
      });
      await insertTransaction(db, {
        amount: 6000, type: 'income', category_id: 3, description: '工资', date: '2026-05-01',
      });
    });

    it('should return monthly totals', async () => {
      const result = await getMonthlyTrend(db, 6);
      expect(result).toHaveLength(2);
      // Should be sorted by month ascending
      const months = result.map(r => r.month);
      expect(months).toEqual(['2026-05', '2026-06']);
      const mayData = result.find(r => r.month === '2026-05')!;
      expect(mayData.income).toBe(6000);
      expect(mayData.expense).toBe(100);
      const junData = result.find(r => r.month === '2026-06')!;
      expect(junData.income).toBe(5000);
      expect(junData.expense).toBeCloseTo(35.5);
    });

    it('should respect the limit parameter', async () => {
      const result = await getMonthlyTrend(db, 1);
      expect(result).toHaveLength(1);
      expect(result[0].month).toBe('2026-06');
    });

    it('should return empty array when no data', async () => {
      db._setTransactions([]);
      const result = await getMonthlyTrend(db, 6);
      expect(result).toHaveLength(0);
    });
  });
});
