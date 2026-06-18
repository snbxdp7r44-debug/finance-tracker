import { CategoryRule } from '../../src/database/types';
import {
  getAllRules,
  getRulesByCategoryId,
  insertRule,
  updateRule,
  deleteRule,
  isKeywordUniqueForCategory,
} from '../../src/database/categoryRuleRepository';

// Mock SQLiteDatabase
const createMockDb = () => {
  let rules: CategoryRule[] = [];
  let nextId = 1;

  return {
    _rules: rules,
    _setRules: (r: CategoryRule[]) => { rules = r; nextId = r.length > 0 ? Math.max(...r.map(rule => rule.id)) + 1 : 1; },

    getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM category_rules') && !sql.includes('JOIN')) {
        if (sql.includes('WHERE category_id = ?')) {
          const catId = params?.[0];
          return rules.filter(r => r.category_id === catId);
        }
        return [...rules];
      }
      // JOIN query for findMatchingRules
      if (sql.includes('JOIN categories')) {
        return rules.map(r => ({
          ...r,
          category_name: '餐饮',
          category_icon: 'food',
          category_color: '#FF5722',
          category_type: 'expense',
        }));
      }
      return [];
    }),

    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT COUNT(*)') && sql.includes('FROM category_rules')) {
        if (params && params.length >= 3) {
          const keyword = params[0];
          const catId = params[1];
          const excludeId = params[2];
          const count = rules.filter(r => r.keyword === keyword && r.category_id === catId && r.id !== excludeId).length;
          return { count };
        }
        if (params && params.length >= 2) {
          const keyword = params[0];
          const catId = params[1];
          const count = rules.filter(r => r.keyword === keyword && r.category_id === catId).length;
          return { count };
        }
        return { count: 0 };
      }
      if (sql.includes('FROM category_rules WHERE keyword = ?')) {
        const keyword = params?.[0];
        return rules.find(r => r.keyword === keyword) ?? null;
      }
      if (sql.includes('FROM category_rules WHERE id = ?')) {
        const id = params?.[0];
        return rules.find(r => r.id === id) ?? null;
      }
      return null;
    }),

    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO category_rules')) {
        const id = nextId++;
        const newRule: CategoryRule = {
          id,
          category_id: params?.[0] ?? 0,
          keyword: params?.[1] ?? '',
          priority: params?.[2] ?? 0,
        };
        rules.push(newRule);
        return { lastInsertRowId: id };
      }
      if (sql.includes('DELETE FROM category_rules')) {
        if (sql.includes('category_id = ?')) {
          const catId = params?.[0];
          rules = rules.filter(r => r.category_id !== catId);
        } else {
          const id = params?.[0];
          rules = rules.filter(r => r.id !== id);
        }
        return {};
      }
      return {};
    }),

    execAsync: jest.fn(async () => {}),
  } as any;
};

describe('categoryRuleRepository', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
    const testRules: CategoryRule[] = [
      { id: 1, category_id: 1, keyword: '午饭', priority: 0 },
      { id: 2, category_id: 1, keyword: '外卖', priority: 0 },
      { id: 3, category_id: 2, keyword: '地铁', priority: 0 },
      { id: 4, category_id: 2, keyword: '打车', priority: 0 },
    ];
    db._setRules(testRules);
  });

  describe('getAllRules', () => {
    it('should return all rules', async () => {
      const result = await getAllRules(db);
      expect(result).toHaveLength(4);
    });
  });

  describe('getRulesByCategoryId', () => {
    it('should return rules for a specific category', async () => {
      const result = await getRulesByCategoryId(db, 1);
      expect(result).toHaveLength(2);
      expect(result.every(r => r.category_id === 1)).toBe(true);
    });

    it('should return empty array for category with no rules', async () => {
      const result = await getRulesByCategoryId(db, 999);
      expect(result).toHaveLength(0);
    });
  });

  describe('insertRule', () => {
    it('should insert a new rule and return its id', async () => {
      const id = await insertRule(db, {
        category_id: 1,
        keyword: '早饭',
        priority: 0,
      });
      expect(id).toBeGreaterThan(0);
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule by id', async () => {
      await deleteRule(db, 1);
      const rules = await getAllRules(db);
      expect(rules.find(r => r.id === 1)).toBeUndefined();
    });
  });

  describe('isKeywordUniqueForCategory', () => {
    it('should return false for existing keyword in same category', async () => {
      const result = await isKeywordUniqueForCategory(db, '午饭', 1);
      expect(result).toBe(false);
    });

    it('should return true for new keyword in same category', async () => {
      const result = await isKeywordUniqueForCategory(db, '早餐', 1);
      expect(result).toBe(true);
    });

    it('should return true for same keyword in different category', async () => {
      // 午饭 exists for category 1, but not category 2
      const result = await isKeywordUniqueForCategory(db, '午饭', 2);
      expect(result).toBe(true);
    });

    it('should return true when excluding own id', async () => {
      const result = await isKeywordUniqueForCategory(db, '午饭', 1, 1);
      expect(result).toBe(true);
    });
  });
});
