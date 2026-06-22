import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from 'react-native-paper';

interface MonthSelectorProps {
  month: string; // YYYY-MM format
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isCurrentMonth?: boolean;
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${year}年${parseInt(m, 10)}月`;
}

export default function MonthSelector({
  month,
  onPrevMonth,
  onNextMonth,
  isCurrentMonth = false,
}: MonthSelectorProps) {
  return (
    <View style={styles.container}>
      <IconButton
        icon="chevron-left"
        size={24}
        onPress={onPrevMonth}
        testID="prev-month-button"
      />
      <Text style={styles.monthLabel} testID="month-label">
        {formatMonthLabel(month)}
      </Text>
      <IconButton
        icon="chevron-right"
        size={24}
        onPress={onNextMonth}
        disabled={isCurrentMonth}
        testID="next-month-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 140,
    textAlign: 'center',
  },
});
