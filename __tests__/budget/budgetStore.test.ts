import { act } from '@testing-library/react-native';
import { useBudgetStore } from '../../src/stores/budgetStore';
import { Budget, BudgetStatus } from '../../src/database/types';

// Mock the budgetRepository
const mockBudgets: Budget[] = [];
const mockStatuses: BudgetStatus[] = [];

jest.mock('../../src/database/budgetRepository', () => ({
  insertBudget: jest.fn(async (_db: any, input: any) => {
    const id = Date.now();
    mockBudgets.push({
      id,
      month: input.month,
      category_id: input.category_id ?? null,
      amount: input.amount,
      rollover_enabled: input.rollover_enabled ?? 0,
      rollover_amount: input.rollover_amount ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return id;
  }),
  getBudgetById: jest.fn(async (_db: any, id: number) => {
    return mockBudgets.find((b) => b.id === id) ?? null;
  }),
  getBudgetForMonthCategory: jest.fn(async (_db: any, month: string, categoryId: number | null) => {
    return mockBudgets.find(
      (b) => b.month === month && b.category_id === categoryId
    ) ?? null;
  }),
  getBudgetsByMonth: jest.fn(async (_db: any, month: string) => {
    return mockBudgets.filter((b) => b.month === month);
  }),
  updateBudget: jest.fn(async (_db: any, id: number, input: any) => {
    const idx = mockBudgets.findIndex((b) => b.id === id);
    if (idx !== -1) {
      Object.assign(mockBudgets[idx], input);
    }
  }),
  deleteBudget: jest.fn(async (_db: any, id: number) => {
    const idx = mockBudgets.findIndex((b) => b.id === id);
    if (idx !== -1) mockBudgets.splice(idx, 1);
  }),
  computeRollover: jest.fn(async () => 0),
  calculateBudgetStatus: jest.fn(async () => [...mockStatuses]),
}));

const mockDb = {};

describe('budgetStore', () => {
  beforeEach(() => {
    // Reset mocks and state
    mockBudgets.length = 0;
    mockStatuses.length = 0;
    jest.clearAllMocks();

    // Reset store state
    useBudgetStore.setState({
      budgets: [],
      budgetStatuses: [],
      loading: false,
      error: null,
    });
  });

  describe('loadBudgetData', () => {
    it('should load budgets and statuses for the given month', async () => {
      const budgetData: Budget = {
        id: 1,
        month: '2026-06',
        category_id: null,
        amount: 3000,
        rollover_enabled: 0,
        rollover_amount: 0,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      };
      mockBudgets.push(budgetData);

      const { loadBudgetData } = useBudgetStore.getState();
      await act(async () => {
        await loadBudgetData(mockDb, '2026-06');
      });

      const state = useBudgetStore.getState();
      expect(state.budgets).toHaveLength(1);
      expect(state.budgets[0].month).toBe('2026-06');
      expect(state.currentMonth).toBe('2026-06');
      expect(state.loading).toBe(false);
    });

    it('should set loading to false on completion', async () => {
      const { loadBudgetData } = useBudgetStore.getState();
      await act(async () => {
        await loadBudgetData(mockDb, '2026-06');
      });
      expect(useBudgetStore.getState().loading).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const { getBudgetsByMonth } = require('../../src/database/budgetRepository');
      getBudgetsByMonth.mockRejectedValueOnce(new Error('DB error'));

      const { loadBudgetData } = useBudgetStore.getState();
      await act(async () => {
        await loadBudgetData(mockDb, '2026-06');
      });

      const state = useBudgetStore.getState();
      expect(state.error).toBe('DB error');
      expect(state.loading).toBe(false);
    });
  });

  describe('addBudget', () => {
    it('should add a new total budget', async () => {
      const { addBudget } = useBudgetStore.getState();
      await act(async () => {
        await addBudget(mockDb, {
          month: '2026-06',
          category_id: null,
          amount: 3000,
        });
      });

      expect(mockBudgets).toHaveLength(1);
      expect(mockBudgets[0].amount).toBe(3000);
      expect(mockBudgets[0].category_id).toBeNull();
    });

    it('should add a per-category budget', async () => {
      const { addBudget } = useBudgetStore.getState();
      await act(async () => {
        await addBudget(mockDb, {
          month: '2026-06',
          category_id: 1,
          amount: 500,
        });
      });

      expect(mockBudgets[0].category_id).toBe(1);
      expect(mockBudgets[0].amount).toBe(500);
    });

    it('should update existing budget if one exists for month+category', async () => {
      const existingBudget: Budget = {
        id: 1,
        month: '2026-06',
        category_id: null,
        amount: 2000,
        rollover_enabled: 0,
        rollover_amount: 0,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      };
      mockBudgets.push(existingBudget);

      const { getBudgetForMonthCategory, updateBudget } = require('../../src/database/budgetRepository');
      getBudgetForMonthCategory.mockResolvedValueOnce(existingBudget);

      const { addBudget } = useBudgetStore.getState();
      await act(async () => {
        await addBudget(mockDb, {
          month: '2026-06',
          category_id: null,
          amount: 3000,
        });
      });

      expect(updateBudget).toHaveBeenCalledWith(
        mockDb,
        1,
        expect.objectContaining({ amount: 3000 })
      );
    });

    it('should return null and set error on failure', async () => {
      const { insertBudget } = require('../../src/database/budgetRepository');
      insertBudget.mockRejectedValueOnce(new Error('Insert failed'));

      const { addBudget } = useBudgetStore.getState();
      let result: any;
      await act(async () => {
        result = await addBudget(mockDb, {
          month: '2026-06',
          category_id: null,
          amount: 3000,
        });
      });

      expect(result).toBeNull();
      expect(useBudgetStore.getState().error).toBeTruthy();
    });
  });

  describe('editBudget', () => {
    it('should update an existing budget', async () => {
      const budget: Budget = {
        id: 1,
        month: '2026-06',
        category_id: null,
        amount: 2000,
        rollover_enabled: 0,
        rollover_amount: 0,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      };
      mockBudgets.push(budget);

      const { getBudgetById, updateBudget } = require('../../src/database/budgetRepository');
      getBudgetById.mockResolvedValue(budget);

      const { editBudget } = useBudgetStore.getState();
      await act(async () => {
        await editBudget(mockDb, 1, { amount: 3000 });
      });

      expect(updateBudget).toHaveBeenCalledWith(
        mockDb,
        1,
        expect.objectContaining({ amount: 3000 })
      );
    });

    it('should reset rollover_amount when rollover is disabled', async () => {
      const budget: Budget = {
        id: 1,
        month: '2026-06',
        category_id: null,
        amount: 2000,
        rollover_enabled: 1,
        rollover_amount: 500,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      };
      mockBudgets.push(budget);

      const { getBudgetById, updateBudget } = require('../../src/database/budgetRepository');
      getBudgetById.mockResolvedValue(budget);

      const { editBudget } = useBudgetStore.getState();
      await act(async () => {
        await editBudget(mockDb, 1, { rollover_enabled: 0 });
      });

      expect(updateBudget).toHaveBeenCalledWith(
        mockDb,
        1,
        expect.objectContaining({ rollover_amount: 0, rollover_enabled: 0 })
      );
    });

    it('should return false for non-existent budget', async () => {
      const { getBudgetById } = require('../../src/database/budgetRepository');
      getBudgetById.mockResolvedValueOnce(null);

      const { editBudget } = useBudgetStore.getState();
      let result: boolean;
      await act(async () => {
        result = await editBudget(mockDb, 999, { amount: 1000 });
      });

      expect(result!).toBe(false);
      expect(useBudgetStore.getState().error).toBe('预算不存在');
    });
  });

  describe('removeBudget', () => {
    it('should remove a budget and reload', async () => {
      const budget: Budget = {
        id: 1,
        month: '2026-06',
        category_id: null,
        amount: 3000,
        rollover_enabled: 0,
        rollover_amount: 0,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      };
      mockBudgets.push(budget);

      const { deleteBudget } = require('../../src/database/budgetRepository');

      const { removeBudget } = useBudgetStore.getState();
      let result: boolean;
      await act(async () => {
        result = await removeBudget(mockDb, 1);
      });

      expect(result!).toBe(true);
      expect(deleteBudget).toHaveBeenCalledWith(mockDb, 1);
    });
  });

  describe('setCurrentMonth', () => {
    it('should update current month', () => {
      const { setCurrentMonth } = useBudgetStore.getState();
      act(() => {
        setCurrentMonth('2026-05');
      });
      expect(useBudgetStore.getState().currentMonth).toBe('2026-05');
    });
  });

  describe('getBudget', () => {
    it('should return budget by id from state', () => {
      const budget: Budget = {
        id: 1,
        month: '2026-06',
        category_id: null,
        amount: 3000,
        rollover_enabled: 0,
        rollover_amount: 0,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      };
      useBudgetStore.setState({ budgets: [budget] });

      const found = useBudgetStore.getState().getBudget(1);
      expect(found).toEqual(budget);
    });

    it('should return undefined for non-existent id', () => {
      useBudgetStore.setState({ budgets: [] });
      const found = useBudgetStore.getState().getBudget(999);
      expect(found).toBeUndefined();
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      useBudgetStore.setState({ error: 'Some error' });
      act(() => {
        useBudgetStore.getState().clearError();
      });
      expect(useBudgetStore.getState().error).toBeNull();
    });
  });
});
