import { useCategoryRuleStore } from '../../src/stores/categoryRuleStore';
import { CategoryRule, CategoryRuleCreateInput, CategoryRuleUpdateInput } from '../../src/database/types';

// Mock categoryRuleRepository
jest.mock('../../src/database/categoryRuleRepository', () => ({
  getAllRules: jest.fn(async (db: any) => {
    return [
      { id: 1, category_id: 1, keyword: '午餐', priority: 10 },
      { id: 2, category_id: 1, keyword: '外卖', priority: 5 },
      { id: 3, category_id: 2, keyword: '工资', priority: 10 },
    ] as CategoryRule[];
  }),
  getRulesByCategoryId: jest.fn(async (db: any, categoryId: number) => {
    return [
      { id: 1, category_id: 1, keyword: '午餐', priority: 10 },
      { id: 2, category_id: 1, keyword: '外卖', priority: 5 },
    ] as CategoryRule[];
  }),
  insertRule: jest.fn(async (db: any, input: CategoryRuleCreateInput) => {
    return 4; // Return mock new ID
  }),
  updateRule: jest.fn(async () => {}),
  deleteRule: jest.fn(async () => {}),
  isKeywordUniqueForCategory: jest.fn(async (db: any, keyword: string, categoryId: number, excludeId?: number) => {
    // Mock: '午餐' already exists for category 1
    if (keyword === '午餐' && categoryId === 1) {
      return excludeId === 1; // Unique only if excluding the existing rule
    }
    return true;
  }),
}));

describe('categoryRuleStore', () => {
  const mockDb = {} as any;

  beforeEach(() => {
    useCategoryRuleStore.setState({
      rules: [],
      loading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  describe('loadRules', () => {
    it('should load all rules', async () => {
      const store = useCategoryRuleStore.getState();
      await store.loadRules(mockDb);

      const state = useCategoryRuleStore.getState();
      expect(state.rules).toHaveLength(3);
      expect(state.rules[0].keyword).toBe('午餐');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const { getAllRules } = require('../../src/database/categoryRuleRepository');
      getAllRules.mockRejectedValueOnce(new Error('DB error'));

      const store = useCategoryRuleStore.getState();
      await store.loadRules(mockDb);

      const state = useCategoryRuleStore.getState();
      expect(state.error).toBe('DB error');
      expect(state.loading).toBe(false);
    });
  });

  describe('loadRulesByCategory', () => {
    it('should load rules for a specific category', async () => {
      const store = useCategoryRuleStore.getState();
      await store.loadRulesByCategory(mockDb, 1);

      const state = useCategoryRuleStore.getState();
      // loadRulesByCategory filters rules by category_id via getRulesByCategoryId
      expect(state.rules).toHaveLength(2);
      expect(state.rules.every(r => r.category_id === 1)).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const { getRulesByCategoryId } = require('../../src/database/categoryRuleRepository');
      getRulesByCategoryId.mockRejectedValueOnce(new Error('DB error'));

      const store = useCategoryRuleStore.getState();
      await store.loadRulesByCategory(mockDb, 1);

      const state = useCategoryRuleStore.getState();
      expect(state.error).toBe('DB error');
      expect(state.loading).toBe(false);
    });
  });

  describe('addRule', () => {
    it('should add a rule and return it', async () => {
      const store = useCategoryRuleStore.getState();
      const result = await store.addRule(mockDb, {
        category_id: 1,
        keyword: '新规则',
        priority: 3,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(4);
      expect(result?.keyword).toBe('新规则');
      expect(result?.category_id).toBe(1);
      expect(result?.priority).toBe(3);

      const state = useCategoryRuleStore.getState();
      expect(state.rules).toHaveLength(1);
    });

    it('should return null if keyword is not unique', async () => {
      const store = useCategoryRuleStore.getState();
      const result = await store.addRule(mockDb, {
        category_id: 1,
        keyword: '午餐',
      });

      expect(result).toBeNull();
      expect(useCategoryRuleStore.getState().error).toBe('该分类下已存在此关键词');
    });

    it('should handle insert errors', async () => {
      const { insertRule } = require('../../src/database/categoryRuleRepository');
      insertRule.mockRejectedValueOnce(new Error('Insert failed'));

      const store = useCategoryRuleStore.getState();
      const result = await store.addRule(mockDb, {
        category_id: 1,
        keyword: '测试',
      });

      expect(result).toBeNull();
      expect(useCategoryRuleStore.getState().error).toBe('Insert failed');
    });
  });

  describe('editRule', () => {
    beforeEach(() => {
      useCategoryRuleStore.setState({
        rules: [
          { id: 1, category_id: 1, keyword: '午餐', priority: 10 },
          { id: 2, category_id: 1, keyword: '外卖', priority: 5 },
        ],
      });
    });

    it('should update a rule and return true', async () => {
      const store = useCategoryRuleStore.getState();
      const result = await store.editRule(mockDb, 1, {
        keyword: '早午餐',
        priority: 8,
      });

      expect(result).toBe(true);

      const state = useCategoryRuleStore.getState();
      const updatedRule = state.rules.find(r => r.id === 1);
      expect(updatedRule?.keyword).toBe('早午餐');
      expect(updatedRule?.priority).toBe(8);
    });

    it('should fail if keyword is not unique', async () => {
      const store = useCategoryRuleStore.getState();
      const result = await store.editRule(mockDb, 2, {
        keyword: '午餐',
        category_id: 1,
      });

      expect(result).toBe(false);
      expect(useCategoryRuleStore.getState().error).toBe('该分类下已存在此关键词');
    });

    it('should handle update errors', async () => {
      const { updateRule } = require('../../src/database/categoryRuleRepository');
      updateRule.mockRejectedValueOnce(new Error('Update failed'));

      const store = useCategoryRuleStore.getState();
      const result = await store.editRule(mockDb, 1, {
        keyword: '晚餐',
      });

      expect(result).toBe(false);
      expect(useCategoryRuleStore.getState().error).toBe('Update failed');
    });
  });

  describe('removeRule', () => {
    beforeEach(() => {
      useCategoryRuleStore.setState({
        rules: [
          { id: 1, category_id: 1, keyword: '午餐', priority: 10 },
          { id: 2, category_id: 1, keyword: '外卖', priority: 5 },
        ],
      });
    });

    it('should remove a rule and return true', async () => {
      const store = useCategoryRuleStore.getState();
      const result = await store.removeRule(mockDb, 1);

      expect(result).toBe(true);
      expect(useCategoryRuleStore.getState().rules).toHaveLength(1);
      expect(useCategoryRuleStore.getState().rules[0].id).toBe(2);
    });

    it('should handle delete errors', async () => {
      const { deleteRule } = require('../../src/database/categoryRuleRepository');
      deleteRule.mockRejectedValueOnce(new Error('Delete failed'));

      const store = useCategoryRuleStore.getState();
      const result = await store.removeRule(mockDb, 1);

      expect(result).toBe(false);
      expect(useCategoryRuleStore.getState().error).toBe('Delete failed');
    });
  });

  describe('getRulesForCategory', () => {
    beforeEach(() => {
      useCategoryRuleStore.setState({
        rules: [
          { id: 1, category_id: 1, keyword: '午餐', priority: 10 },
          { id: 2, category_id: 1, keyword: '外卖', priority: 5 },
          { id: 3, category_id: 2, keyword: '工资', priority: 10 },
        ],
      });
    });

    it('should filter rules by category_id', () => {
      const rules = useCategoryRuleStore.getState().getRulesForCategory(1);
      expect(rules).toHaveLength(2);
      expect(rules.every(r => r.category_id === 1)).toBe(true);
    });

    it('should return empty array for category with no rules', () => {
      const rules = useCategoryRuleStore.getState().getRulesForCategory(999);
      expect(rules).toHaveLength(0);
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      useCategoryRuleStore.setState({ error: 'Some error' });
      useCategoryRuleStore.getState().clearError();
      expect(useCategoryRuleStore.getState().error).toBeNull();
    });
  });
});
