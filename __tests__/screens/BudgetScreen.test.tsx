import React from 'react';
import { render } from '@testing-library/react-native';
import BudgetScreen from '../../app/(tabs)/budget';

describe('BudgetScreen', () => {
  it('renders the budget screen', () => {
    const { getByText } = render(<BudgetScreen />);
    expect(getByText('预算')).toBeTruthy();
  });
});
