import { create } from 'zustand';
import {
  Budget,
  BudgetCreateInput,
  BudgetUpdateInput,
  BudgetStatus,
} from '../database/types';
import {
  insertBudget,
  getBudgetById,
  getBudgetForMonthCategory,
  getBudgetsByMonth,
  updateBudget,
  deleteBudget,
  calculateBudgetStatus,
  computeRollover,
} from '../database/budgetRepository';

interface BudgetState {
  budgets: Budget[];
  budgetStatuses: BudgetStatus[];
  currentMonth: string; // YYYY-MM format
  loading: boolean;
  error: string | null;

  loadBudgetData: (db: any, month: string) => Promise<void>;
  addBudget: (db: any, input: BudgetCreateInput) => Promise<Budget | null>;
  editBudget: (db: any, id: number, input: BudgetUpdateInput) => Promise<boolean>;
  removeBudget: (db: any, id: number) => Promise<boolean>;
  setCurrentMonth: (month: string) => void;
  getBudget: (id: number) => Budget | undefined;
  clearError: () => void;
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  budgetStatuses: [],
  currentMonth: getCurrentMonth(),
  loading: false,
  error: null,

  loadBudgetData: async (db, month) => {
    set({ loading: true, error: null });
    try {
      const [budgets, budgetStatuses] = await Promise.all([
        getBudgetsByMonth(db, month),
        calculateBudgetStatus(db, month),
      ]);
      set({
        budgets,
        budgetStatuses,
        currentMonth: month,
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  addBudget: async (db, input) => {
    set({ error: null });
    try {
      // Check if budget already exists for this month+category
      const existing = await getBudgetForMonthCategory(
        db,
        input.month,
        input.category_id
      );

      let budget: Budget | null = null;

      if (existing) {
        // Update existing budget
        await updateBudget(db, existing.id, {
          amount: input.amount,
          rollover_enabled: input.rollover_enabled ?? existing.rollover_enabled,
          rollover_amount: input.rollover_amount ?? existing.rollover_amount,
        });
        budget = await getBudgetById(db, existing.id);
      } else {
        // Compute rollover if enabled
        let rolloverAmount = 0;
        if (input.rollover_enabled) {
          rolloverAmount = await computeRollover(
            db,
            input.month,
            input.category_id,
            input.rollover_enabled
          );
        }
        const id = await insertBudget(db, {
          ...input,
          rollover_amount: rolloverAmount,
        });
        budget = await getBudgetById(db, id);
      }

      // Reload budget data for current month
      const currentMonth = get().currentMonth;
      if (input.month === currentMonth) {
        const [budgets, budgetStatuses] = await Promise.all([
          getBudgetsByMonth(db, currentMonth),
          calculateBudgetStatus(db, currentMonth),
        ]);
        set({ budgets, budgetStatuses });
      }

      return budget;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  editBudget: async (db, id, input) => {
    set({ error: null });
    try {
      // Get existing budget to access month and category_id for rollover
      const existing = await getBudgetById(db, id);
      if (!existing) {
        set({ error: '预算不存在' });
        return false;
      }

      // If rollover is being enabled, recompute rollover amount
      let updateInput = { ...input };
      const rolloverEnabled = input.rollover_enabled ?? existing.rollover_enabled;
      if (rolloverEnabled) {
        const rolloverAmount = await computeRollover(
          db,
          existing.month,
          existing.category_id,
          rolloverEnabled
        );
        updateInput = { ...updateInput, rollover_amount: rolloverAmount };
      } else if (input.rollover_enabled === 0) {
        // Explicitly disabled: reset rollover_amount
        updateInput = { ...updateInput, rollover_amount: 0 };
      }

      await updateBudget(db, id, updateInput);

      // Reload budget data for current month
      const currentMonth = get().currentMonth;
      if (existing.month === currentMonth) {
        const [budgets, budgetStatuses] = await Promise.all([
          getBudgetsByMonth(db, currentMonth),
          calculateBudgetStatus(db, currentMonth),
        ]);
        set({ budgets, budgetStatuses });
      }

      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  removeBudget: async (db, id) => {
    set({ error: null });
    try {
      await deleteBudget(db, id);

      // Reload budget data for current month
      const currentMonth = get().currentMonth;
      const [budgets, budgetStatuses] = await Promise.all([
        getBudgetsByMonth(db, currentMonth),
        calculateBudgetStatus(db, currentMonth),
      ]);
      set({ budgets, budgetStatuses });

      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  setCurrentMonth: (month) => {
    set({ currentMonth: month });
  },

  getBudget: (id) => {
    return get().budgets.find((b) => b.id === id);
  },

  clearError: () => set({ error: null }),
}));
