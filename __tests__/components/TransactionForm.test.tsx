import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: React.ReactNode }) => children,
  useSQLiteContext: () => ({
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1 })),
    execAsync: jest.fn(async () => {}),
  }),
}));

// Mock autoCategorize with a controllable mock
const mockSuggestCategory: jest.Mock = jest.fn(async () => null);
jest.mock('../../src/utils/autoCategorize', () => ({
  suggestCategory: (db: any, desc: any) => mockSuggestCategory(db, desc),
}));

// Mock categoryStore
jest.mock('../../src/stores/categoryStore', () => ({
  useCategoryStore: () => ({
    categories: [
      { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense', is_default: 1 },
      { id: 2, name: '交通', icon: 'car', color: '#2196F3', type: 'expense', is_default: 1 },
      { id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income', is_default: 1 },
    ],
    loadCategories: jest.fn(async () => {}),
    getCategoriesForType: (type: string) => {
      const cats = [
        { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense', is_default: 1 },
        { id: 2, name: '交通', icon: 'car', color: '#2196F3', type: 'expense', is_default: 1 },
        { id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income', is_default: 1 },
      ];
      return cats.filter((c: any) => c.type === type);
    },
    getCategory: (id: number) => {
      const cats: Record<number, any> = {
        1: { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense' },
        2: { id: 2, name: '交通', icon: 'car', color: '#2196F3', type: 'expense' },
        3: { id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income' },
      };
      return cats[id];
    },
  }),
}));

// Mock transactionStore
jest.mock('../../src/stores/transactionStore', () => ({
  useTransactionStore: () => ({
    addTransaction: jest.fn(async () => null),
    submitting: false,
    error: null,
  }),
}));

// Mock CategorySelector to expose selectedCategoryId as observable testID text
jest.mock('../../src/components/CategorySelector', () => {
  const { View, Text } = require('react-native');
  return (props: any) => (
    <View>
      <Text testID="selected-category-id">
        {props.selectedCategoryId !== null && props.selectedCategoryId !== undefined
          ? String(props.selectedCategoryId)
          : 'none'}
      </Text>
      {props.error ? <Text testID="category-error">{props.error}</Text> : null}
    </View>
  );
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    MaterialCommunityIcons: (props: any) => <View {...props} />,
  };
});

// Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(() => 'light'),
}));

// Mock react-native-paper SegmentedButtons for reliable type toggle testing
jest.mock('react-native-paper', () => {
  const actualPaper = jest.requireActual('react-native-paper');
  const { View, TouchableOpacity, Text } = require('react-native');
  return {
    ...actualPaper,
    SegmentedButtons: ({ onValueChange, value, buttons }: any) => (
      <View>
        {buttons.map((btn: any) => (
          <TouchableOpacity
            key={btn.value}
            testID={`type-btn-${btn.value}`}
            onPress={() => onValueChange(btn.value)}
          >
            <Text>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

import TransactionForm from '../../src/components/TransactionForm';

describe('TransactionForm - auto-categorization debounce (stale closure fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('auto-selects expense category when type stays as expense during debounce', async () => {
    // suggestCategory returns an expense category
    mockSuggestCategory.mockResolvedValue({
      category: { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense' },
    });

    const { getByTestId, getByPlaceholderText } = render(<TransactionForm />);

    // Verify initial state: no category selected
    expect(getByTestId('selected-category-id').props.children).toBe('none');

    // Type description (default type is 'expense')
    fireEvent.changeText(getByPlaceholderText('输入描述可自动分类'), '咖啡');

    // Advance timers past the 300ms debounce
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // Expense category should be auto-selected since type is still expense
    await waitFor(() => {
      expect(getByTestId('selected-category-id').props.children).toBe('1');
    });
  });

  it('does not auto-select stale expense category when type changes to income during debounce', async () => {
    // suggestCategory returns an expense category (matching the original type before switch)
    mockSuggestCategory.mockResolvedValue({
      category: { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense' },
    });

    const { getByTestId, getByPlaceholderText } = render(<TransactionForm />);

    // Type description while in default expense mode — starts the 300ms debounce
    fireEvent.changeText(getByPlaceholderText('输入描述可自动分类'), '咖啡');

    // Change type to income BEFORE the 300ms debounce fires (race condition)
    // typeRef.current becomes 'income' immediately
    fireEvent.press(getByTestId('type-btn-income'));

    // Advance timers past the 300ms debounce — the callback fires now
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // No category should be auto-selected: the suggestion was 'expense' but the
    // current type (via typeRef.current) is now 'income' — they don't match.
    // Without the fix, the stale closure would have seen type='expense', matching
    // the suggestion, and incorrectly set an expense category in income mode.
    await waitFor(() => {
      expect(getByTestId('selected-category-id').props.children).toBe('none');
    });

    expect(mockSuggestCategory).toHaveBeenCalledWith(expect.anything(), '咖啡');
  });

  it('auto-selects income category when type is income and suggestion matches', async () => {
    // suggestCategory returns an income category
    mockSuggestCategory.mockResolvedValue({
      category: { id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income' },
    });

    const { getByTestId, getByPlaceholderText } = render(<TransactionForm />);

    // Switch to income mode first
    fireEvent.press(getByTestId('type-btn-income'));

    // Type description
    fireEvent.changeText(getByPlaceholderText('输入描述可自动分类'), '工资');

    // Advance timers past the 300ms debounce
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // Income category should be auto-selected since type is income and suggestion matches
    await waitFor(() => {
      expect(getByTestId('selected-category-id').props.children).toBe('3');
    });
  });

  it('does not auto-select income category when type changes from income to expense during debounce', async () => {
    // suggestCategory returns an income category (matching the original type before switch)
    mockSuggestCategory.mockResolvedValue({
      category: { id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income' },
    });

    const { getByTestId, getByPlaceholderText } = render(<TransactionForm />);

    // Switch to income mode first
    fireEvent.press(getByTestId('type-btn-income'));

    // Type description while in income mode — starts the 300ms debounce
    fireEvent.changeText(getByPlaceholderText('输入描述可自动分类'), '工资');

    // Change type back to expense BEFORE the 300ms timer fires
    fireEvent.press(getByTestId('type-btn-expense'));

    // Advance timers past the 300ms debounce
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // No category should be auto-selected: the income suggestion doesn't match
    // the current type ('expense'), so typeRef.current prevents the stale assignment.
    await waitFor(() => {
      expect(getByTestId('selected-category-id').props.children).toBe('none');
    });
  });

  it('does not auto-select when suggestCategory returns null', async () => {
    mockSuggestCategory.mockResolvedValue(null);

    const { getByTestId, getByPlaceholderText } = render(<TransactionForm />);

    fireEvent.changeText(getByPlaceholderText('输入描述可自动分类'), '随便');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(getByTestId('selected-category-id').props.children).toBe('none');
    });
  });

  it('debounce cancels previous timeout when description changes rapidly', async () => {
    mockSuggestCategory.mockResolvedValue({
      category: { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense' },
    });

    const { getByTestId, getByPlaceholderText } = render(<TransactionForm />);

    // Rapidly change description
    fireEvent.changeText(getByPlaceholderText('输入描述可自动分类'), '咖');
    fireEvent.changeText(getByPlaceholderText('输入描述可自动分类'), '咖啡');

    // Only 100ms passed - neither debounce should have fired
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(getByTestId('selected-category-id').props.children).toBe('none');

    // Advance past the debounce window for the last description change
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    // suggestCategory should have been called once (for '咖啡'), not twice
    await waitFor(() => {
      expect(mockSuggestCategory).toHaveBeenCalledTimes(1);
      expect(mockSuggestCategory).toHaveBeenCalledWith(expect.anything(), '咖啡');
    });
  });
});
