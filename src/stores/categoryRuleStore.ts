import { create } from 'zustand';
import { CategoryRule, CategoryRuleCreateInput, CategoryRuleUpdateInput } from '../database/types';
import {
  getAllRules,
  insertRule,
  updateRule,
  deleteRule,
  isKeywordUniqueForCategory,
} from '../database/categoryRuleRepository';

interface CategoryRuleState {
  rules: CategoryRule[];
  loading: boolean;
  error: string | null;

  loadRules: (db: any) => Promise<void>;
  loadRulesByCategory: (db: any, categoryId: number) => Promise<void>;
  addRule: (db: any, input: CategoryRuleCreateInput) => Promise<CategoryRule | null>;
  editRule: (db: any, id: number, input: CategoryRuleUpdateInput) => Promise<boolean>;
  removeRule: (db: any, id: number) => Promise<boolean>;
  getRulesForCategory: (categoryId: number) => CategoryRule[];
  clearError: () => void;
}

export const useCategoryRuleStore = create<CategoryRuleState>((set, get) => ({
  rules: [],
  loading: false,
  error: null,

  loadRules: async (db) => {
    set({ loading: true, error: null });
    try {
      const rules = await getAllRules(db);
      set({ rules, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadRulesByCategory: async (db, _categoryId) => {
    set({ loading: true, error: null });
    try {
      const allRules = await getAllRules(db);
      set({ rules: allRules, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  addRule: async (db, input) => {
    set({ error: null });
    try {
      // Validate keyword uniqueness for this category
      const isUnique = await isKeywordUniqueForCategory(db, input.keyword, input.category_id);
      if (!isUnique) {
        set({ error: '该分类下已存在此关键词' });
        return null;
      }

      const id = await insertRule(db, input);
      const newRule: CategoryRule = {
        id,
        category_id: input.category_id,
        keyword: input.keyword,
        priority: input.priority ?? 0,
      };
      set((state) => ({
        rules: [...state.rules, newRule],
      }));
      return newRule;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  editRule: async (db, id, input) => {
    set({ error: null });
    try {
      // Validate keyword uniqueness if keyword is being changed
      if (input.keyword !== undefined) {
        const isUnique = await isKeywordUniqueForCategory(
          db,
          input.keyword,
          input.category_id ?? (get().rules.find(r => r.id === id)?.category_id ?? 0),
          id
        );
        if (!isUnique) {
          set({ error: '该分类下已存在此关键词' });
          return false;
        }
      }

      await updateRule(db, id, input);
      set((state) => ({
        rules: state.rules.map((r) => {
          if (r.id === id) {
            return {
              ...r,
              ...(input.category_id !== undefined ? { category_id: input.category_id } : {}),
              ...(input.keyword !== undefined ? { keyword: input.keyword } : {}),
              ...(input.priority !== undefined ? { priority: input.priority } : {}),
            };
          }
          return r;
        }),
      }));
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  removeRule: async (db, id) => {
    set({ error: null });
    try {
      await deleteRule(db, id);
      set((state) => ({
        rules: state.rules.filter((r) => r.id !== id),
      }));
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  getRulesForCategory: (categoryId) => {
    return get().rules.filter((r) => r.category_id === categoryId);
  },

  clearError: () => set({ error: null }),
}));
