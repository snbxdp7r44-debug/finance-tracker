import React from 'react';
import { render } from '@testing-library/react-native';
import TransactionAddScreen from '../../app/(tabs)/transaction-add';

describe('TransactionAddScreen', () => {
  it('renders the add transaction screen', () => {
    const { getByText } = render(<TransactionAddScreen />);
    expect(getByText('记一笔')).toBeTruthy();
  });
});
