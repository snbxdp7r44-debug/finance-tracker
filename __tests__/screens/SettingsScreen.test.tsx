import React from 'react';
import { render } from '@testing-library/react-native';
import SettingsScreen from '../../app/(tabs)/settings';

describe('SettingsScreen', () => {
  it('renders the settings screen', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('设置')).toBeTruthy();
  });
});
