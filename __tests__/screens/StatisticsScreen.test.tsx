import React from 'react';
import { render, act } from '@testing-library/react-native';

const mockDb = {};

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: jest.fn(() => mockDb),
}));

// Mock the chart libraries
jest.mock('react-native-chart-kit', () => ({
  LineChart: () => null,
  PieChart: () => null,
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
}));

// Mock database functions
jest.mock('../../src/database', () => ({
  getMonthlyTrend: jest.fn(async () => [
    { month: '2026-05', income: 6000, expense: 100 },
    { month: '2026-06', income: 5000, expense: 35.5 },
  ]),
  getMonthlyExpenseByCategory: jest.fn(async () => [
    { category_id: 1, category_name: '餐饮', category_icon: 'food', category_color: '#FF5722', total: 35.5 },
  ]),
}));

describe('StatisticsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the statistics screen title', async () => {
    const StatisticsScreen = require('../../app/(tabs)/statistics').default;
    const { findByText } = render(<StatisticsScreen />);

    const title = await findByText('统计');
    expect(title).toBeTruthy();
  });

  it('renders the trend chart section', async () => {
    const StatisticsScreen = require('../../app/(tabs)/statistics').default;
    const { findByText } = render(<StatisticsScreen />);

    const chartTitle = await findByText('收支趋势（近6个月）');
    expect(chartTitle).toBeTruthy();
  });

  it('renders the expense pie chart section', async () => {
    const StatisticsScreen = require('../../app/(tabs)/statistics').default;
    const { findByText } = render(<StatisticsScreen />);

    const pieTitle = await findByText('支出分类占比', { exact: false });
    expect(pieTitle).toBeTruthy();
  });
});
