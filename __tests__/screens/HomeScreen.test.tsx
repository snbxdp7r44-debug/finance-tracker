import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../../app/(tabs)/index';

describe('HomeScreen', () => {
  it('renders the home screen with title', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('首页')).toBeTruthy();
  });

  it('renders welcome message', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('欢迎使用记账应用')).toBeTruthy();
  });
});
