import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native-paper';

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

// Mock expo-router
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, back: jest.fn() }),
  usePathname: () => '/transaction-add',
  useGlobalSearchParams: () => ({}),
}));

// Mock database migrations
jest.mock('../../src/database/migrations', () => ({
  runMigrations: jest.fn(async () => {}),
}));

// Mock transactionStore
const mockAddTransaction = jest.fn(async () => ({
  id: 1,
  amount: 35.5,
  type: 'expense',
  category_id: 1,
  description: '午餐',
  date: '2026-06-15',
  created_at: '2026-06-15T12:00:00Z',
  updated_at: '2026-06-15T12:00:00Z',
  category_name: '餐饮',
  category_icon: 'food',
  category_color: '#FF5722',
}));
const mockLoadMonthlyData = jest.fn(async () => {});

jest.mock('../../src/stores/transactionStore', () => ({
  useTransactionStore: () => ({
    addTransaction: mockAddTransaction,
    loadMonthlyData: mockLoadMonthlyData,
    currentMonth: '2026-06',
    submitting: false,
    error: null,
  }),
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
      return cats.filter(c => c.type === type);
    },
    getCategory: (id: number) => {
      const cats: Record<number, any> = {
        1: { id: 1, name: '餐饮', icon: 'food', color: '#FF5722' },
        2: { id: 2, name: '交通', icon: 'car', color: '#2196F3' },
        3: { id: 3, name: '工资', icon: 'cash', color: '#4CAF50' },
      };
      return cats[id];
    },
  }),
}));

// Mock autoCategorize
jest.mock('../../src/utils/autoCategorize', () => ({
  suggestCategory: jest.fn(async () => null),
}));

// Mock CategorySelector
jest.mock('../../src/components/CategorySelector', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return (props: any) => (
    <View>
      <Text testID="category-selector">分类</Text>
      {props.error ? <Text testID="category-error">{props.error}</Text> : null}
      {props.type === 'expense' ? (
        <TouchableOpacity
          testID="select-expense-category"
          onPress={() => props.onSelect({ id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense' })}
        >
          <Text>餐饮</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          testID="select-income-category"
          onPress={() => props.onSelect({ id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income' })}
        >
          <Text>工资</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// Mock CategoryIcon
jest.mock('../../src/components/CategoryIcon', () => {
  const { Text } = require('react-native');
  return (props: any) => <Text testID={`category-icon-${props.iconName}`}>{props.iconName}</Text>;
});

// Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(() => 'light'),
}));

describe('TransactionAddScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the transaction add screen with title', () => {
    const TransactionAddScreen = require('../../app/(tabs)/transaction-add').default;
    const { getAllByText } = render(<TransactionAddScreen />);
    // Title "记一笔" and submit button "记一笔" both exist
    const matches = getAllByText('记一笔');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders form elements', () => {
    const TransactionAddScreen = require('../../app/(tabs)/transaction-add').default;
    const { getByText, getByPlaceholderText, UNSAFE_getAllByType } = render(<TransactionAddScreen />);
    // Type toggle buttons
    expect(getByText('支出')).toBeTruthy();
    expect(getByText('收入')).toBeTruthy();
    // Category selector
    expect(getByText('分类')).toBeTruthy();
    // Description and date placeholders
    expect(getByPlaceholderText('输入描述可自动分类')).toBeTruthy();
    expect(getByPlaceholderText('YYYY-MM-DD')).toBeTruthy();
    // TextInput components for amount and other fields
    const textInputs = UNSAFE_getAllByType(TextInput);
    expect(textInputs.length).toBeGreaterThanOrEqual(3); // amount, description, date
  });

  it('shows validation error on empty amount submit', async () => {
    const TransactionAddScreen = require('../../app/(tabs)/transaction-add').default;
    const { getByText, getAllByText } = render(<TransactionAddScreen />);

    // Select a category first to avoid category error
    fireEvent.press(getByText('餐饮'));

    // Submit with empty amount - use last "记一笔" which is the button
    const submitButtons = getAllByText('记一笔');
    // The button is the last one rendered (after the title)
    fireEvent.press(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(getByText('请输入金额')).toBeTruthy();
    });
  });

  it('shows validation error when no category selected', async () => {
    const TransactionAddScreen = require('../../app/(tabs)/transaction-add').default;
    const { getByText, UNSAFE_getAllByType, getAllByText } = render(<TransactionAddScreen />);

    // Enter amount using the first TextInput (amount field)
    const textInputs = UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(textInputs[0], '35.5');

    // Submit without category
    const submitButtons = getAllByText('记一笔');
    fireEvent.press(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(getByText('请选择分类')).toBeTruthy();
    });
  });

  it('submits valid expense transaction', async () => {
    const TransactionAddScreen = require('../../app/(tabs)/transaction-add').default;
    const { getByText, UNSAFE_getAllByType, getAllByText } = render(<TransactionAddScreen />);

    // Fill in the amount (first TextInput)
    const textInputs = UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(textInputs[0], '35.5');

    // Select category
    fireEvent.press(getByText('餐饮'));

    // Submit
    const submitButtons = getAllByText('记一笔');
    fireEvent.press(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 35.5,
          type: 'expense',
          category_id: 1,
        })
      );
    });
  });

  it('navigates to home after successful submit', async () => {
    const TransactionAddScreen = require('../../app/(tabs)/transaction-add').default;
    const { getByText, UNSAFE_getAllByType, getAllByText } = render(<TransactionAddScreen />);

    // Fill in the form
    const textInputs = UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(textInputs[0], '35.5');

    // Select category
    fireEvent.press(getByText('餐饮'));

    // Submit
    const submitButtons = getAllByText('记一笔');
    fireEvent.press(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
