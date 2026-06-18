import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

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

// Mock database migrations
jest.mock('../src/database/migrations', () => ({
  runMigrations: jest.fn(async () => {}),
}));

// Mock expo-router
jest.mock('expo-router', () => {
  const { View: RView } = require('react-native');
  return {
    Slot: () => <RView testID="expo-slot" />,
  };
});

// Mock react-native-paper
jest.mock('react-native-paper', () => ({
  PaperProvider: ({ children }: { children: React.ReactNode }) => children,
  MD3DarkTheme: { colors: { primary: '#bb86fc', background: '#121212' } },
  MD3LightTheme: { colors: { primary: '#6200ee', background: '#ffffff' } },
}));

// Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(() => 'light'),
}));

describe('RootLayout', () => {
  it('renders PaperProvider with Slot', () => {
    const RootLayout = require('../app/_layout').default;
    const { getByTestId } = render(<RootLayout />);
    expect(getByTestId('expo-slot')).toBeTruthy();
  });
});
