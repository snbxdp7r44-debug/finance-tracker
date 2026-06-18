import { SQLiteDatabase } from 'expo-sqlite';
import {
  getAllCategories,
  getCategoriesByType,
  getCategoryById,
  getCategoryByName,
  getDefaultCategories,
  getCustomCategories,
  insertCategory,
  updateCategory,
  deleteCategory,
  isCategoryInUse,
  getCategoryTransactionCount,
  isDefaultCategory,
  isCategoryNameUnique,
} from '../../src/database/categoryRepository';
import { Category } from '../../src/database/types';

// Mock SQLiteDatabase
const createMockDb = () => {
  let categories: Category[] = [];
  let nextId = 1;

  return {
    _categories: categories,
    _setCategories: (cats: Category[]) => { categories = cats; nextId = cats.length > 0 ? Math.max(...cats.map(c => c.id)) + 1 : 1; },

    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM categories')) {
        if (sql.includes('is_default = 1')) {
          return categories.filter(c => c.is_default === 1);
        }
        if (sql.includes('is_default = 0') && sql.includes('type = ?')) {
          // getCustomCategoriesByType - handled separately
          return categories.filter(c => c.is_default === 0);
        }
        if (sql.includes('is_default = 0')) {
          return categories.filter(c => c.is_default === 0);
        }
        if (sql.includes('type = ?')) {
          return categories.filter(c => c.type === 'expense'); // default param
        }
        return [...categories];
      }
      if (sql.includes('FROM transactions')) {
        return [];
      }
      return [];
    }),

    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT COUNT(*)')) {
        if (sql.includes('FROM transactions')) {
          const catId = params?.[0];
          const count = 0; // No transactions in test
          return { count };
        }
        if (sql.includes('FROM categories WHERE name = ?')) {
          if (params && params.length >= 2) {
            // isCategoryNameUnique with excludeId
            const name = params[0];
            const excludeId = params[1];
            const count = categories.filter(c => c.name === name && c.id !== excludeId).length;
            return { count };
          }
          const name = params?.[0] ?? '';
          const count = categories.filter(c => c.name === name).length;
          return { count };
        }
        return { count: 0 };
      }
      if (sql.includes('FROM categories WHERE id = ?')) {
        const id = params?.[0];
        return categories.find(c => c.id === id) ?? null;
      }
      if (sql.includes('FROM categories WHERE name = ?')) {
        const name = params?.[0];
        return categories.find(c => c.name === name) ?? null;
      }
      if (sql.includes('is_default FROM categories')) {
        const id = params?.[0];
        const cat = categories.find(c => c.id === id);
        return cat ? { is_default: cat.is_default } : null;
      }
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: 1 };
      }
      return null;
    }),

    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO categories')) {
        const id = nextId++;
        const newCat: Category = {
          id,
          name: params?.[0] ?? '',
          icon: params?.[1] ?? 'star',
          color: params?.[2] ?? '#607D8B',
          type: params?.[3] ?? 'expense',
          is_default: params?.[4] ?? 0,
          created_at: new Date().toISOString(),
        };
        categories.push(newCat);
        return { lastInsertRowId: id };
      }
      if (sql.includes('UPDATE categories')) {
        // Parse the SET fields and update the matching category
        const lastParam = params?.[params.length - 1]; // The id is always the last param
        const catIndex = categories.findIndex(c => c.id === lastParam);
        if (catIndex !== -1) {
          // Parse SET clause from SQL
          const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
          if (setMatch) {
            const setClauses = setMatch[1].split(',').map(s => s.trim());
            let paramIdx = 0;
            for (const clause of setClauses) {
              const fieldMatch = clause.match(/(\w+)\s*=\s*\?/);
              if (fieldMatch) {
                const field = fieldMatch[1] as keyof Category;
                (categories[catIndex] as any)[field] = params?.[paramIdx];
                paramIdx++;
              }
            }
          }
        }
        return {};
      }
      if (sql.includes('DELETE FROM categories')) {
        const id = params?.[0];
        categories = categories.filter(c => c.id !== id);
        return {};
      }
      return {};
    }),

    execAsync: jest.fn(async () => {}),

    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
      await task();
    }),
  } as unknown as SQLiteDatabase;
};

describe('categoryRepository', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
    // Seed some test data
    const cats: Category[] = [
      { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense', is_default: 1, created_at: '2026-01-01' },
      { id: 2, name: '交通', icon: 'car', color: '#2196F3', type: 'expense', is_default: 1, created_at: '2026-01-01' },
      { id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income', is_default: 1, created_at: '2026-01-01' },
      { id: 4, name: '宠物', icon: 'pets', color: '#9C27B0', type: 'expense', is_default: 0, created_at: '2026-06-01' },
    ];
    db._setCategories(cats);
  });

  describe('getAllCategories', () => {
    it('should return all categories', async () => {
      const result = await getAllCategories(db);
      expect(result).toHaveLength(4);
    });
  });

  describe('getCategoryById', () => {
    it('should return a category by id', async () => {
      const result = await getCategoryById(db, 1);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('餐饮');
    });

    it('should return null for non-existent id', async () => {
      const result = await getCategoryById(db, 999);
      expect(result).toBeNull();
    });
  });

  describe('getCategoryByName', () => {
    it('should return a category by name', async () => {
      const result = await getCategoryByName(db, '餐饮');
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    it('should return null for non-existent name', async () => {
      const result = await getCategoryByName(db, '不存在');
      expect(result).toBeNull();
    });
  });

  describe('insertCategory', () => {
    it('should insert a new category and return its id', async () => {
      const id = await insertCategory(db, {
        name: '旅游',
        icon: 'airplane',
        color: '#03A9F4',
        type: 'expense',
      });
      expect(id).toBeGreaterThan(0);
      const cat = await getCategoryById(db, id);
      expect(cat?.name).toBe('旅游');
    });
  });

  describe('updateCategory', () => {
    it('should update a category name', async () => {
      await updateCategory(db, 4, { name: '宠物护理' });
      const cat = await getCategoryById(db, 4);
      expect(cat?.name).toBe('宠物护理');
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      await deleteCategory(db, 4);
      const cat = await getCategoryById(db, 4);
      expect(cat).toBeNull();
    });
  });

  describe('isDefaultCategory', () => {
    it('should return true for default category', async () => {
      const result = await isDefaultCategory(db, 1);
      expect(result).toBe(true);
    });

    it('should return false for custom category', async () => {
      const result = await isDefaultCategory(db, 4);
      expect(result).toBe(false);
    });
  });

  describe('isCategoryNameUnique', () => {
    it('should return false for existing name', async () => {
      const result = await isCategoryNameUnique(db, '餐饮');
      expect(result).toBe(false);
    });

    it('should return true for new name', async () => {
      const result = await isCategoryNameUnique(db, '旅游');
      expect(result).toBe(true);
    });

    it('should return true for existing name when excluding own id', async () => {
      const result = await isCategoryNameUnique(db, '餐饮', 1);
      expect(result).toBe(true);
    });

    it('should return false for duplicate name excluding different id', async () => {
      const result = await isCategoryNameUnique(db, '餐饮', 2);
      expect(result).toBe(false);
    });
  });

  describe('isCategoryInUse', () => {
    it('should return false when no transactions reference the category', async () => {
      const result = await isCategoryInUse(db, 1);
      expect(result).toBe(false);
    });
  });
});
