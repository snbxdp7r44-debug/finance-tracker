import { useTransactionStore } from '../../src/stores/transactionStore';
import { Transaction, TransactionCreateInput, TransactionType } from '../../src/database/types';

// Mock transactionRepository
jest.mock('../../src/database/transactionRepository', () => ({
  insertTransaction: jest.fn(async (db: any, input: TransactionCreateInput) => {
    return 1; // Return mock ID
  }),
  getTransactionById: jest.fn(async (db: any, id: number) => {
    if (id === 1) {
      return {
        id: 1,
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
        created_at: '2026-06-15T12:00:00Z',
        updated_at: '2026-06-15T12:00:00Z',
        category_name: '餐饮',
        category_icon: 'food',
        category_color: '#FF5722',
      } as Transaction;
    }
    return null;
  }),
  updateTransaction: jest.fn(async () => {}),
  deleteTransaction: jest.fn(async () => {}),
  getTransactionsByMonth: jest.fn(async (db: any, month: string) => {
    if (month === '2026-06') {
      return [
        {
          id: 1,
          amount: 35.5,
          type: 'expense',
          category_id: 1,
          description: '午餐',
          date: '2026-06-15',
          created_at: '2026-06-15T12:00:00Z',
          updated_at: '2026-06-15T12:00:00Z',
          category_name: '餐饮',
          category_icon: 'food',
          category_color: '#FF5722',
        },
        {
          id: 2,
          amount: 5000,
          type: 'income',
          category_id: 3,
          description: '工资',
          date: '2026-06-01',
          created_at: '2026-06-01T09:00:00Z',
          updated_at: '2026-06-01T09:00:00Z',
          category_name: '工资',
          category_icon: 'cash',
          category_color: '#4CAF50',
        },
      ] as Transaction[];
    }
    return [];
  }),
  getMonthlyTotals: jest.fn(async (db: any, month: string) => {
    if (month === '2026-06') {
      return { income: 5000, expense: 35.5 };
    }
    return { income: 0, expense: 0 };
  }),
  getMonthlyExpenseByCategory: jest.fn(async (db: any, month: string) => {
    if (month === '2026-06') {
      return [
        { category_id: 1, category_name: '餐饮', category_icon: 'food', category_color: '#FF5722', total: 35.5 },
      ];
    }
    return [];
  }),
}));

describe('transactionStore', () => {
  const mockDb = {} as any;

  beforeEach(() => {
    // Reset the store to initial state
    useTransactionStore.setState({
      transactions: [],
      monthlyTotals: { income: 0, expense: 0 },
      categoryExpenses: [],
      currentMonth: '2026-06',
      loading: false,
      submitting: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  describe('loadMonthlyData', () => {
    it('should load transactions and totals for a month', async () => {
      const store = useTransactionStore.getState();
      await store.loadMonthlyData(mockDb, '2026-06');

      const state = useTransactionStore.getState();
      expect(state.transactions).toHaveLength(2);
      expect(state.monthlyTotals.income).toBe(5000);
      expect(state.monthlyTotals.expense).toBeCloseTo(35.5);
      expect(state.categoryExpenses).toHaveLength(1);
      expect(state.currentMonth).toBe('2026-06');
      expect(state.loading).toBe(false);
    });

    it('should set loading state during load', async () => {
      const store = useTransactionStore.getState();
      const loadPromise = store.loadMonthlyData(mockDb, '2026-06');
      // Should be loading at this point
      expect(useTransactionStore.getState().loading).toBe(true);
      await loadPromise;
      expect(useTransactionStore.getState().loading).toBe(false);
    });

    it('should handle empty month data', async () => {
      const store = useTransactionStore.getState();
      await store.loadMonthlyData(mockDb, '2025-01');

      const state = useTransactionStore.getState();
      expect(state.transactions).toHaveLength(0);
      expect(state.monthlyTotals.income).toBe(0);
      expect(state.monthlyTotals.expense).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      const { getTransactionsByMonth } = require('../../src/database/transactionRepository');
      getTransactionsByMonth.mockRejectedValueOnce(new Error('DB error'));

      const store = useTransactionStore.getState();
      await store.loadMonthlyData(mockDb, '2026-06');

      const state = useTransactionStore.getState();
      expect(state.error).toBe('DB error');
      expect(state.loading).toBe(false);
    });
  });

  describe('addTransaction', () => {
    it('should add a transaction and reload data', async () => {
      const store = useTransactionStore.getState();
      // Set current month to match the transaction date
      useTransactionStore.setState({ currentMonth: '2026-06' });

      const result = await store.addTransaction(mockDb, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(35.5);

      const state = useTransactionStore.getState();
      expect(state.submitting).toBe(false);
      // Should have reloaded data for the current month
      expect(state.transactions).toHaveLength(2);
    });

    it('should set submitting state during add', async () => {
      const store = useTransactionStore.getState();
      useTransactionStore.setState({ currentMonth: '2026-06' });

      const addPromise = store.addTransaction(mockDb, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });

      expect(useTransactionStore.getState().submitting).toBe(true);
      await addPromise;
      expect(useTransactionStore.getState().submitting).toBe(false);
    });

    it('should return null and set error on failure', async () => {
      const { insertTransaction } = require('../../src/database/transactionRepository');
      insertTransaction.mockRejectedValueOnce(new Error('Insert failed'));

      const store = useTransactionStore.getState();
      const result = await store.addTransaction(mockDb, {
        amount: 35.5,
        type: 'expense',
        category_id: 1,
        description: '午餐',
        date: '2026-06-15',
      });

      expect(result).toBeNull();
      expect(useTransactionStore.getState().error).toBe('Insert failed');
      expect(useTransactionStore.getState().submitting).toBe(false);
    });
  });

  describe('removeTransaction', () => {
    it('should remove a transaction and reload data', async () => {
      // First set up some data
      useTransactionStore.setState({ currentMonth: '2026-06' });
      const store = useTransactionStore.getState();
      await store.loadMonthlyData(mockDb, '2026-06');

      // Now delete
      const result = await store.removeTransaction(mockDb, 1);
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      const { deleteTransaction } = require('../../src/database/transactionRepository');
      deleteTransaction.mockRejectedValueOnce(new Error('Delete failed'));

      const store = useTransactionStore.getState();
      const result = await store.removeTransaction(mockDb, 1);
      expect(result).toBe(false);
      expect(useTransactionStore.getState().error).toBe('Delete failed');
    });
  });

  describe('setCurrentMonth', () => {
    it('should update the current month', () => {
      const store = useTransactionStore.getState();
      store.setCurrentMonth('2026-05');
      expect(useTransactionStore.getState().currentMonth).toBe('2026-05');
    });
  });

  describe('getTransaction', () => {
    it('should find a transaction by id', async () => {
      useTransactionStore.setState({ currentMonth: '2026-06' });
      const store = useTransactionStore.getState();
      await store.loadMonthlyData(mockDb, '2026-06');

      const transaction = useTransactionStore.getState().getTransaction(1);
      expect(transaction).toBeDefined();
      expect(transaction?.amount).toBe(35.5);
    });

    it('should return undefined for non-existent id', () => {
      const transaction = useTransactionStore.getState().getTransaction(999);
      expect(transaction).toBeUndefined();
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      useTransactionStore.setState({ error: 'Some error' });
      useTransactionStore.getState().clearError();
      expect(useTransactionStore.getState().error).toBeNull();
    });
  });
});
