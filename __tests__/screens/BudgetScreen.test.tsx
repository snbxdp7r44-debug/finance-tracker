import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Budget, BudgetStatus } from '../../src/database/types';

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
}));

// Mock database migrations
jest.mock('../../src/database/migrations', () => ({
  runMigrations: jest.fn(async () => {}),
}));

// Mock react-native-paper (use actual module but override Portal)
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

// Mock MonthSelector
jest.mock('../../src/components/MonthSelector', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({ month, onPrevMonth, onNextMonth, isCurrentMonth }: any) => (
    <View>
      <TouchableOpacity testID="prev-month-button" onPress={onPrevMonth}>
        <Text>prev</Text>
      </TouchableOpacity>
      <Text testID="month-label">
        {(() => {
          const [year, m] = month.split('-');
          return `${year}年${parseInt(m, 10)}月`;
        })()}
      </Text>
      <TouchableOpacity
        testID="next-month-button"
        onPress={onNextMonth}
        disabled={isCurrentMonth}
      >
        <Text>next</Text>
      </TouchableOpacity>
    </View>
  );
});

// Mock BudgetProgressCard
jest.mock('../../src/components/BudgetProgressCard', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({
    status,
    categoryName,
    onEdit,
    onDelete,
  }: any) => (
    <View testID={`budget-card-${status.budget.id}`}>
      <Text>
        {status.budget.category_id === null ? '总预算' : (categoryName ?? '未知')}
      </Text>
      <Text>
        {`已花费 ¥${status.spending.toFixed(2)} / 预算 ¥${status.effectiveBudget.toFixed(2)}`}
      </Text>
      {status.isOverBudget ? (
        <Text testID={`over-budget-${status.budget.id}`}>
          {`超出预算 ¥${(status.spending - status.effectiveBudget).toFixed(2)}`}
        </Text>
      ) : null}
      <TouchableOpacity testID={`edit-budget-${status.budget.id}`} onPress={onEdit}>
        <Text>编辑</Text>
      </TouchableOpacity>
      <TouchableOpacity testID={`delete-budget-${status.budget.id}`} onPress={onDelete}>
        <Text>删除</Text>
      </TouchableOpacity>
    </View>
  );
});

// Mock BudgetSettingDialog
jest.mock('../../src/components/BudgetSettingDialog', () => {
  const { View, Text } = require('react-native');
  return ({ visible }: any) =>
    visible ? (
      <View testID="budget-setting-dialog">
        <Text>预算对话框</Text>
      </View>
    ) : null;
});

// Default mock budget data
const mockBudget: Budget = {
  id: 1,
  month: '2026-06',
  category_id: null,
  amount: 3000,
  rollover_enabled: 0,
  rollover_amount: 0,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const mockStatus: BudgetStatus = {
  budget: mockBudget,
  spending: 500,
  effectiveBudget: 3000,
  percentage: 16.67,
  isOverBudget: false,
  rolloverFromPrevious: 0,
};

const mockLoadBudgetData = jest.fn(async () => {});
const mockAddBudget = jest.fn(async () => mockBudget);
const mockEditBudget = jest.fn(async () => true);
const mockRemoveBudget = jest.fn(async () => true);
const mockSetCurrentMonth = jest.fn();

// Mutable state that tests can modify
let mockBudgets: Budget[] = [];
let mockBudgetStatuses: BudgetStatus[] = [];
let mockCurrentMonth = '2026-06';

jest.mock('../../src/stores/budgetStore', () => ({
  useBudgetStore: () => ({
    get budgets() { return mockBudgets; },
    get budgetStatuses() { return mockBudgetStatuses; },
    get currentMonth() { return mockCurrentMonth; },
    loading: false,
    error: null,
    loadBudgetData: mockLoadBudgetData,
    addBudget: mockAddBudget,
    editBudget: mockEditBudget,
    removeBudget: mockRemoveBudget,
    setCurrentMonth: mockSetCurrentMonth,
    getBudget: jest.fn(),
    clearError: jest.fn(),
  }),
}));

// Mock transactionStore
jest.mock('../../src/stores/transactionStore', () => ({
  useTransactionStore: () => ({
    loadMonthlyData: jest.fn(async () => {}),
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
  }),
}));

// Mock CategoryIcon
jest.mock('../../src/components/CategoryIcon', () => {
  const { Text } = require('react-native');
  return (props: any) => <Text>{props.iconName}</Text>;
});

// Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(() => 'light'),
}));

describe('BudgetScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBudgets = [];
    mockBudgetStatuses = [];
    mockCurrentMonth = '2026-06';
  });

  it('renders the budget screen with month selector', () => {
    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId } = render(<BudgetScreen />);
    expect(getByTestId('month-label')).toBeTruthy();
  });

  it('shows empty state when no budgets', () => {
    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId } = render(<BudgetScreen />);
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('shows empty state text in Chinese', () => {
    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByText } = render(<BudgetScreen />);
    expect(getByText('暂无预算，点击添加')).toBeTruthy();
  });

  it('renders month label in YYYY年MM月 format', () => {
    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByText } = render(<BudgetScreen />);
    expect(getByText('2026年6月')).toBeTruthy();
  });

  it('shows FAB with add budget label', () => {
    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByText } = render(<BudgetScreen />);
    expect(getByText('添加预算')).toBeTruthy();
  });

  it('shows budget cards when budgets exist', () => {
    mockBudgets = [mockBudget];
    mockBudgetStatuses = [mockStatus];

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { queryByTestId } = render(<BudgetScreen />);
    // Empty state should NOT be shown
    expect(queryByTestId('empty-state')).toBeNull();
    // Budget card should be visible
    expect(queryByTestId('budget-card-1')).toBeTruthy();
  });

  it('shows total budget card with correct info', () => {
    mockBudgets = [mockBudget];
    mockBudgetStatuses = [mockStatus];

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByText } = render(<BudgetScreen />);
    expect(getByText('总预算')).toBeTruthy();
    expect(getByText(/已花费/)).toBeTruthy();
  });

  it('shows overspend warning when over budget', () => {
    const overBudgetStatus: BudgetStatus = {
      ...mockStatus,
      spending: 3500,
      percentage: 116.67,
      isOverBudget: true,
    };
    mockBudgets = [mockBudget];
    mockBudgetStatuses = [overBudgetStatus];

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByText } = render(<BudgetScreen />);
    expect(getByText(/超出预算/)).toBeTruthy();
  });

  it('navigates to previous month when prev arrow pressed', () => {
    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId } = render(<BudgetScreen />);
    fireEvent.press(getByTestId('prev-month-button'));
    expect(mockSetCurrentMonth).toHaveBeenCalledWith('2026-05');
  });

  it('next month button is disabled/non-interactive at current month', () => {
    // Set current month to actual current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    mockCurrentMonth = currentMonth;

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId } = render(<BudgetScreen />);

    // Press the next button - should NOT navigate because isCurrentMonth is true
    // BudgetScreen's handleNextMonth returns early when isCurrentMonth is true
    fireEvent.press(getByTestId('next-month-button'));
    expect(mockSetCurrentMonth).not.toHaveBeenCalled();
  });

  it('loads budget data on mount', () => {
    const BudgetScreen = require('../../app/(tabs)/budget').default;
    render(<BudgetScreen />);
    expect(mockLoadBudgetData).toHaveBeenCalledWith(
      expect.anything(),
      '2026-06'
    );
  });

  it('shows confirmation dialog before deleting', async () => {
    mockBudgets = [mockBudget];
    mockBudgetStatuses = [mockStatus];

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId, getByText } = render(<BudgetScreen />);

    // Press delete button on budget card
    await act(async () => {
      fireEvent.press(getByTestId('delete-budget-1'));
    });

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(getByText('确认删除')).toBeTruthy();
    });
  });

  it('deletes budget after confirmation', async () => {
    mockBudgets = [mockBudget];
    mockBudgetStatuses = [mockStatus];

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId } = render(<BudgetScreen />);

    // Press delete
    await act(async () => {
      fireEvent.press(getByTestId('delete-budget-1'));
    });

    // Confirm delete
    await act(async () => {
      fireEvent.press(getByTestId('confirm-delete-button'));
    });

    expect(mockRemoveBudget).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it('does not delete budget when cancel is pressed', async () => {
    mockBudgets = [mockBudget];
    mockBudgetStatuses = [mockStatus];

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId } = render(<BudgetScreen />);

    // Press delete
    await act(async () => {
      fireEvent.press(getByTestId('delete-budget-1'));
    });

    // Cancel delete
    await act(async () => {
      fireEvent.press(getByTestId('cancel-delete-button'));
    });

    expect(mockRemoveBudget).not.toHaveBeenCalled();
  });

  it('year boundary navigation from January goes to December of prior year', () => {
    mockCurrentMonth = '2026-01';

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByTestId } = render(<BudgetScreen />);
    fireEvent.press(getByTestId('prev-month-button'));
    expect(mockSetCurrentMonth).toHaveBeenCalledWith('2025-12');
  });

  it('shows per-category budgets with category info', () => {
    const catBudget: Budget = {
      id: 2,
      month: '2026-06',
      category_id: 1,
      amount: 500,
      rollover_enabled: 0,
      rollover_amount: 0,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    };
    const catStatus: BudgetStatus = {
      budget: catBudget,
      spending: 200,
      effectiveBudget: 500,
      percentage: 40,
      isOverBudget: false,
      rolloverFromPrevious: 0,
    };
    mockBudgets = [catBudget];
    mockBudgetStatuses = [catStatus];

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByText } = render(<BudgetScreen />);
    expect(getByText('餐饮')).toBeTruthy();
  });

  it('month label shows correct year boundary (January -> December prior year)', () => {
    mockCurrentMonth = '2026-01';

    const BudgetScreen = require('../../app/(tabs)/budget').default;
    const { getByText } = render(<BudgetScreen />);
    expect(getByText('2026年1月')).toBeTruthy();
  });
});
