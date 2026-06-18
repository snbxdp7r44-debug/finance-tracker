import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

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
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  useGlobalSearchParams: () => ({}),
}));

// Mock database migrations
jest.mock('../../src/database/migrations', () => ({
  runMigrations: jest.fn(async () => {}),
}));

// Mock react-native-paper Portal
jest.mock('react-native-paper', () => {
  const RealModule = jest.requireActual('react-native-paper');
  return {
    ...RealModule,
    Portal: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock react-native-safe-area-context (required by Dialog)
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaConsumer: ({ children }: { children: (insets: any) => React.ReactNode }) => children(inset),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
  };
});

// Mock transactionStore
const mockLoadMonthlyData = jest.fn(async () => {});
const mockRemoveTransaction = jest.fn(async () => true);
const mockSetCurrentMonth = jest.fn();

jest.mock('../../src/stores/transactionStore', () => ({
  useTransactionStore: () => ({
    transactions: [
      {
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
      },
      {
        id: 2,
        amount: 5000,
        type: 'income',
        category_id: 3,
        description: '工资',
        date: '2026-06-01',
        created_at: '2026-06-01T09:00:00Z',
        updated_at: '2026-06-01T09:00:00Z',
        category_name: '工资',
        category_icon: 'cash',
        category_color: '#4CAF50',
      },
    ],
    monthlyTotals: { income: 5000, expense: 35.5 },
    currentMonth: '2026-06',
    loadMonthlyData: mockLoadMonthlyData,
    removeTransaction: mockRemoveTransaction,
    setCurrentMonth: mockSetCurrentMonth,
    loading: false,
    submitting: false,
    error: null,
  }),
}));

// Mock formatAmount function used in HomeScreen
// Since the component uses .toFixed(2), the amounts will be formatted as strings

// Mock categoryStore
jest.mock('../../src/stores/categoryStore', () => ({
  useCategoryStore: () => ({
    categories: [
      { id: 1, name: '餐饮', icon: 'food', color: '#FF5722', type: 'expense', is_default: 1 },
      { id: 3, name: '工资', icon: 'cash', color: '#4CAF50', type: 'income', is_default: 1 },
    ],
    loadCategories: jest.fn(async () => {}),
    getCategory: (id: number) => {
      const cats: Record<number, any> = {
        1: { id: 1, name: '餐饮', icon: 'food', color: '#FF5722' },
        3: { id: 3, name: '工资', icon: 'cash', color: '#4CAF50' },
      };
      return cats[id];
    },
  }),
}));

// Mock CategoryIcon
jest.mock('../../src/components/CategoryIcon', () => {
  const { Text } = require('react-native');
  return (props: any) => <Text testID={`category-icon-${props.iconName}`}>{props.iconName}</Text>;
});

// Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(() => 'light'),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders monthly income and expense summary', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    const { getAllByText } = render(<HomeScreen />);
    // Income and expense labels appear in the summary cards
    const incomeLabels = getAllByText('收入');
    const expenseLabels = getAllByText('支出');
    expect(incomeLabels.length).toBeGreaterThan(0);
    expect(expenseLabels.length).toBeGreaterThan(0);
  });

  it('renders monthly amount totals', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    const { getByText } = render(<HomeScreen />);
    expect(getByText('¥5000.00')).toBeTruthy();
    expect(getByText('¥35.50')).toBeTruthy();
  });

  it('renders net balance', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    const { getByText } = render(<HomeScreen />);
    expect(getByText('结余')).toBeTruthy();
    // 5000 - 35.5 = 4964.5
    expect(getByText('¥4964.50')).toBeTruthy();
  });

  it('renders month label with current month', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    const { getByText } = render(<HomeScreen />);
    expect(getByText('2026年6月')).toBeTruthy();
  });

  it('renders recent transactions with category names', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    const { getByText, getAllByText } = render(<HomeScreen />);
    expect(getByText('午餐')).toBeTruthy();
    // "工资" appears as both category name and description, use getAllByText
    const salaryLabels = getAllByText('工资');
    expect(salaryLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('renders transaction amounts with type indicators', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    const { getByText } = render(<HomeScreen />);
    expect(getByText('-¥35.50')).toBeTruthy();
    expect(getByText('+¥5000.00')).toBeTruthy();
  });

  it('renders transaction dates', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    const { getByText } = render(<HomeScreen />);
    expect(getByText('2026-06-15')).toBeTruthy();
    expect(getByText('2026-06-01')).toBeTruthy();
  });

  it('loads monthly data on mount', () => {
    const HomeScreen = require('../../app/(tabs)/index').default;
    render(<HomeScreen />);
    expect(mockLoadMonthlyData).toHaveBeenCalled();
  });
});
