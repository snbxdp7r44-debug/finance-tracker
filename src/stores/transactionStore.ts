import { create } from 'zustand';
import {
  Transaction,
  TransactionCreateInput,
  TransactionUpdateInput,
  MonthlyTotals,
  CategoryExpenseTotal,
  TransactionType,
} from '../database/types';
import {
  insertTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionsByMonth,
  getMonthlyTotals,
  getMonthlyExpenseByCategory,
} from '../database/transactionRepository';

interface TransactionState {
  transactions: Transaction[];
  monthlyTotals: MonthlyTotals;
  categoryExpenses: CategoryExpenseTotal[];
  currentMonth: string; // YYYY-MM format
  loading: boolean;
  submitting: boolean;
  error: string | null;

  loadMonthlyData: (db: any, month: string) => Promise<void>;
  addTransaction: (db: any, input: TransactionCreateInput) => Promise<Transaction | null>;
  editTransaction: (db: any, id: number, input: TransactionUpdateInput) => Promise<boolean>;
  removeTransaction: (db: any, id: number) => Promise<boolean>;
  setCurrentMonth: (month: string) => void;
  getTransaction: (id: number) => Transaction | undefined;
  clearError: () => void;
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  monthlyTotals: { income: 0, expense: 0 },
  categoryExpenses: [],
  currentMonth: getCurrentMonth(),
  loading: false,
  submitting: false,
  error: null,

  loadMonthlyData: async (db, month) => {
    set({ loading: true, error: null });
    try {
      const [transactions, monthlyTotals, categoryExpenses] = await Promise.all([
        getTransactionsByMonth(db, month),
        getMonthlyTotals(db, month),
        getMonthlyExpenseByCategory(db, month),
      ]);
      set({
        transactions,
        monthlyTotals,
        categoryExpenses,
        currentMonth: month,
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  addTransaction: async (db, input) => {
    set({ submitting: true, error: null });
    try {
      const id = await insertTransaction(db, input);
      const transaction = await getTransactionById(db, id);
      if (transaction) {
        // Reload monthly data to reflect changes
        const month = input.date.substring(0, 7); // YYYY-MM
        const currentMonth = get().currentMonth;
        if (month === currentMonth) {
          // Update the current month's data
          const [transactions, monthlyTotals, categoryExpenses] = await Promise.all([
            getTransactionsByMonth(db, currentMonth),
            getMonthlyTotals(db, currentMonth),
            getMonthlyExpenseByCategory(db, currentMonth),
          ]);
          set({
            transactions,
            monthlyTotals,
            categoryExpenses,
            submitting: false,
          });
        } else {
          set({ submitting: false });
        }
        return transaction;
      }
      set({ submitting: false });
      return null;
    } catch (e: any) {
      set({ error: e.message, submitting: false });
      return null;
    }
  },

  editTransaction: async (db, id, input) => {
    set({ error: null });
    try {
      await updateTransaction(db, id, input);
      // Reload current month data
      const currentMonth = get().currentMonth;
      const [transactions, monthlyTotals, categoryExpenses] = await Promise.all([
        getTransactionsByMonth(db, currentMonth),
        getMonthlyTotals(db, currentMonth),
        getMonthlyExpenseByCategory(db, currentMonth),
      ]);
      set({
        transactions,
        monthlyTotals,
        categoryExpenses,
      });
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  removeTransaction: async (db, id) => {
    set({ error: null });
    try {
      await deleteTransaction(db, id);
      // Reload current month data
      const currentMonth = get().currentMonth;
      const [transactions, monthlyTotals, categoryExpenses] = await Promise.all([
        getTransactionsByMonth(db, currentMonth),
        getMonthlyTotals(db, currentMonth),
        getMonthlyExpenseByCategory(db, currentMonth),
      ]);
      set({
        transactions,
        monthlyTotals,
        categoryExpenses,
      });
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  setCurrentMonth: (month) => {
    set({ currentMonth: month });
  },

  getTransaction: (id) => {
    return get().transactions.find((t) => t.id === id);
  },

  clearError: () => set({ error: null }),
}));
