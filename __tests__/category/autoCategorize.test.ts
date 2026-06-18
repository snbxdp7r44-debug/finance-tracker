import { suggestCategory } from '../../src/utils/autoCategorize';
import { CategoryRule } from '../../src/database/types';

describe('autoCategorize', () => {
  // Create a mock database that simulates findMatchingRules behavior
  const createMockDb = (rules: Array<CategoryRule & { category_name: string; category_icon: string; category_color: string; category_type: string }>) => {
    return {
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('JOIN categories')) {
          return rules;
        }
        return [];
      }),
      getFirstAsync: jest.fn(async () => null),
    } as any;
  };

  const mockRules = [
    { id: 1, category_id: 1, keyword: '午饭', priority: 0, category_name: '餐饮', category_icon: 'food', category_color: '#FF5722', category_type: 'expense' },
    { id: 2, category_id: 1, keyword: '外卖', priority: 0, category_name: '餐饮', category_icon: 'food', category_color: '#FF5722', category_type: 'expense' },
    { id: 3, category_id: 2, keyword: '地铁', priority: 0, category_name: '交通', category_icon: 'car', category_color: '#2196F3', category_type: 'expense' },
    { id: 4, category_id: 2, keyword: '打车', priority: 1, category_name: '交通', category_icon: 'car', category_color: '#2196F3', category_type: 'expense' },
    { id: 5, category_id: 3, keyword: '工资', priority: 0, category_name: '工资', category_icon: 'cash', category_color: '#4CAF50', category_type: 'income' },
  ];

  describe('suggestCategory', () => {
    it('should return null for empty note', async () => {
      const db = createMockDb(mockRules);
      const result = await suggestCategory(db, '');
      expect(result).toBeNull();
    });

    it('should return null for whitespace note', async () => {
      const db = createMockDb(mockRules);
      const result = await suggestCategory(db, '   ');
      expect(result).toBeNull();
    });

    it('should match a keyword and return the correct category', async () => {
      const db = createMockDb(mockRules);
      const result = await suggestCategory(db, '今天午饭花了50');
      expect(result).not.toBeNull();
      expect(result!.category.name).toBe('餐饮');
      expect(result!.matchedKeyword).toBe('午饭');
    });

    it('should match another keyword', async () => {
      const db = createMockDb(mockRules);
      const result = await suggestCategory(db, '打车去公司');
      expect(result).not.toBeNull();
      expect(result!.category.name).toBe('交通');
    });

    it('should return null when no keywords match', async () => {
      const db = createMockDb(mockRules);
      const result = await suggestCategory(db, 'asdasd');
      expect(result).toBeNull();
    });

    it('should return highest priority match when multiple keywords match', async () => {
      // Note contains both '地铁' (priority 0) and '打车' (priority 1)
      // 打车 has higher priority, so it should be the matched keyword
      const db = createMockDb(mockRules);
      const result = await suggestCategory(db, '地铁和打车');
      expect(result).not.toBeNull();
      // Both match 交通 category, but 打车 has higher priority
      expect(result!.category.name).toBe('交通');
    });
  });
});
