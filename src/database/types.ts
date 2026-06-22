// Database type definitions

export type TransactionType = 'income' | 'expense';

export interface Category {
  id: number;
  name: string;
  icon: string; // MaterialCommunityIcons name
  color: string; // hex color e.g. '#FF5722'
  type: TransactionType;
  is_default: number; // 0 or 1 (SQLite boolean)
  created_at: string;
}

export interface CategoryRule {
  id: number;
  category_id: number;
  keyword: string;
  priority: number;
}

// Form types for creating/updating
export interface CategoryCreateInput {
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  is_default?: number;
}

export interface CategoryUpdateInput {
  name?: string;
  icon?: string;
  color?: string;
  type?: TransactionType;
}

export interface CategoryRuleCreateInput {
  category_id: number;
  keyword: string;
  priority?: number;
}

export interface CategoryRuleUpdateInput {
  category_id?: number;
  keyword?: string;
  priority?: number;
}

// Transaction types

export interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  category_id: number;
  description: string;
  date: string; // YYYY-MM-DD format
  created_at: string;
  updated_at: string;
  // Joined fields (populated by queries with JOIN)
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface TransactionCreateInput {
  amount: number;
  type: TransactionType;
  category_id: number;
  description?: string;
  date: string; // YYYY-MM-DD format
}

export interface TransactionUpdateInput {
  amount?: number;
  type?: TransactionType;
  category_id?: number;
  description?: string;
  date?: string;
}

export interface MonthlyTotals {
  income: number;
  expense: number;
}

export interface CategoryExpenseTotal {
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  total: number;
}

// Budget types

export interface Budget {
  id: number;
  month: string; // YYYY-MM format
  category_id: number | null; // NULL for total budget
  amount: number;
  rollover_enabled: number; // 0 or 1 (SQLite boolean)
  rollover_amount: number; // accumulated rollover from previous month
  created_at: string;
  updated_at: string;
}

export interface BudgetCreateInput {
  month: string;
  category_id: number | null;
  amount: number;
  rollover_enabled?: number;
  rollover_amount?: number;
}

export interface BudgetUpdateInput {
  amount?: number;
  rollover_enabled?: number;
  rollover_amount?: number;
}

export interface BudgetStatus {
  budget: Budget;
  spending: number;
  effectiveBudget: number; // amount + rolloverFromPrevious
  percentage: number; // spending / effectiveBudget * 100
  isOverBudget: boolean;
  rolloverFromPrevious: number;
}
