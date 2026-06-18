import { create } from 'zustand';
import { useSQLiteContext } from 'expo-sqlite';
import { Category, TransactionType, CategoryCreateInput, CategoryUpdateInput } from '../database/types';
import {
  getAllCategories,
  getCategoriesByType,
  getCategoryById,
  insertCategory,
  updateCategory,
  deleteCategory,
  isCategoryInUse,
  getCategoryTransactionCount,
  isDefaultCategory,
  isCategoryNameUnique,
} from '../database/categoryRepository';

interface CategoryState {
  categories: Category[];
  loading: boolean;
  error: string | null;

  loadCategories: (db: any) => Promise<void>;
  loadCategoriesByType: (db: any, type: TransactionType) => Promise<void>;
  addCategory: (db: any, input: CategoryCreateInput) => Promise<Category | null>;
  editCategory: (db: any, id: number, input: CategoryUpdateInput) => Promise<boolean>;
  removeCategory: (db: any, id: number) => Promise<{ success: boolean; inUse: boolean; transactionCount: number }>;
  forceRemoveCategory: (db: any, id: number) => Promise<boolean>;
  checkNameUnique: (db: any, name: string, excludeId?: number) => Promise<boolean>;
  getCategory: (id: number) => Category | undefined;
  getCategoriesForType: (type: TransactionType) => Category[];
  getDefaultCategoriesForType: (type: TransactionType) => Category[];
  getCustomCategoriesForType: (type: TransactionType) => Category[];
  clearError: () => void;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loading: false,
  error: null,

  loadCategories: async (db) => {
    set({ loading: true, error: null });
    try {
      const categories = await getAllCategories(db);
      set({ categories, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadCategoriesByType: async (db, type) => {
    set({ loading: true, error: null });
    try {
      const categories = await getCategoriesByType(db, type);
      set({ categories, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  addCategory: async (db, input) => {
    set({ error: null });
    try {
      // Validate unique name
      const isUnique = await isCategoryNameUnique(db, input.name);
      if (!isUnique) {
        set({ error: '分类已存在' });
        return null;
      }

      const id = await insertCategory(db, input);
      const newCategory = await getCategoryById(db, id);
      if (newCategory) {
        set((state) => ({
          categories: [...state.categories, newCategory].sort(
            (a, b) => b.is_default - a.is_default || a.type.localeCompare(b.type) || a.id - b.id
          ),
        }));
      }
      return newCategory;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  editCategory: async (db, id, input) => {
    set({ error: null });
    try {
      // Check if it's a default category
      const isDefault = await isDefaultCategory(db, id);
      if (isDefault) {
        set({ error: '预设分类不可编辑' });
        return false;
      }

      // Validate unique name if name is being changed
      if (input.name) {
        const isUnique = await isCategoryNameUnique(db, input.name, id);
        if (!isUnique) {
          set({ error: '分类已存在' });
          return false;
        }
      }

      await updateCategory(db, id, input);
      const updatedCategory = await getCategoryById(db, id);
      if (updatedCategory) {
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? updatedCategory : c
          ),
        }));
      }
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  removeCategory: async (db, id) => {
    set({ error: null });
    try {
      // Check if it's a default category
      const isDefault = await isDefaultCategory(db, id);
      if (isDefault) {
        set({ error: '预设分类不可删除' });
        return { success: false, inUse: false, transactionCount: 0 };
      }

      // Check if category is in use
      const inUse = await isCategoryInUse(db, id);
      const transactionCount = await getCategoryTransactionCount(db, id);

      if (inUse) {
        // Return info so UI can show warning
        return { success: false, inUse: true, transactionCount };
      }

      await deleteCategory(db, id);
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
      return { success: true, inUse: false, transactionCount: 0 };
    } catch (e: any) {
      set({ error: e.message });
      return { success: false, inUse: false, transactionCount: 0 };
    }
  },

  forceRemoveCategory: async (db: any, id: number) => {
    set({ error: null });
    try {
      const isDefault = await isDefaultCategory(db, id);
      if (isDefault) {
        set({ error: '预设分类不可删除' });
        return false;
      }

      await deleteCategory(db, id);
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  checkNameUnique: async (db, name, excludeId) => {
    return isCategoryNameUnique(db, name, excludeId);
  },

  getCategory: (id) => {
    return get().categories.find((c) => c.id === id);
  },

  getCategoriesForType: (type) => {
    return get().categories.filter((c) => c.type === type);
  },

  getDefaultCategoriesForType: (type) => {
    return get().categories.filter((c) => c.type === type && c.is_default === 1);
  },

  getCustomCategoriesForType: (type) => {
    return get().categories.filter((c) => c.type === type && c.is_default === 0);
  },

  clearError: () => set({ error: null }),
}));
