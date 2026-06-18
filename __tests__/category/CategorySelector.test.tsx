import React from 'react';
import { render } from '@testing-library/react-native';
import { Category, TransactionType } from '../../src/database/types';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1 })),
  }),
  SQLiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock stores
const mockCategories: Category[] = [
  { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense', is_default: 1, created_at: '2026-01-01' },
  { id: 2, name: '交通', icon: 'car', color: '#2196F3', type: 'expense', is_default: 1, created_at: '2026-01-01' },
  { id: 5, name: '宠物', icon: 'pets', color: '#9C27B0', type: 'expense', is_default: 0, created_at: '2026-06-01' },
];

jest.mock('../../src/stores/categoryStore', () => ({
  useCategoryStore: () => ({
    categories: mockCategories,
    loading: false,
    error: null,
    loadCategories: jest.fn(),
    getCategory: (id: number) => mockCategories.find(c => c.id === id),
    getDefaultCategoriesForType: (type: TransactionType) => mockCategories.filter(c => c.type === type && c.is_default === 1),
    getCustomCategoriesForType: (type: TransactionType) => mockCategories.filter(c => c.type === type && c.is_default === 0),
  }),
}));

// Import after mocks
import CategorySelector from '../../src/components/CategorySelector';

describe('CategorySelector', () => {
  it('should render with default and custom sections', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <CategorySelector type="expense" onSelect={onSelect} />
    );
    expect(getByText('预设分类')).toBeTruthy();
    expect(getByText('自定义分类')).toBeTruthy();
  });

  it('should render category names', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <CategorySelector type="expense" onSelect={onSelect} />
    );
    expect(getByText('餐饮')).toBeTruthy();
    expect(getByText('交通')).toBeTruthy();
    expect(getByText('宠物')).toBeTruthy();
  });

  it('should show error message when provided', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <CategorySelector type="expense" onSelect={onSelect} error="请选择分类" />
    );
    expect(getByText('请选择分类')).toBeTruthy();
  });
});
