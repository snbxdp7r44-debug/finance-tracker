import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, IconButton } from 'react-native-paper';
import { BudgetStatus } from '../database/types';
import CategoryIcon from './CategoryIcon';

interface BudgetProgressCardProps {
  status: BudgetStatus;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  onEdit: () => void;
  onDelete: () => void;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function getBarColor(percentage: number): string {
  if (percentage >= 100) return '#F44336'; // red
  if (percentage >= 75) return '#FF9800'; // yellow/orange
  return '#4CAF50'; // green
}

export default function BudgetProgressCard({
  status,
  categoryName,
  categoryIcon,
  categoryColor,
  onEdit,
  onDelete,
}: BudgetProgressCardProps) {
  const { budget, spending, effectiveBudget, percentage, isOverBudget, rolloverFromPrevious } =
    status;

  const isTotal = budget.category_id === null;
  const displayName = isTotal ? '总预算' : (categoryName ?? '未知分类');
  const barColor = getBarColor(percentage);
  // Cap the visual width at 100%
  const barWidth = `${Math.min(percentage, 100)}%` as `${number}%`;
  const overspend = spending - effectiveBudget;

  return (
    <Card style={styles.card} testID={`budget-card-${budget.id}`}>
      <Card.Content>
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {!isTotal && categoryIcon && categoryColor ? (
              <CategoryIcon
                iconName={categoryIcon}
                color={categoryColor}
                size={18}
              />
            ) : null}
            <Text style={styles.categoryName}>{displayName}</Text>
            {rolloverFromPrevious > 0 ? (
              <Text style={styles.rolloverBadge}>
                +¥{formatAmount(rolloverFromPrevious)} 结转
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <IconButton
              icon="pencil"
              size={18}
              onPress={onEdit}
              testID={`edit-budget-${budget.id}`}
            />
            <IconButton
              icon="delete"
              size={18}
              onPress={onDelete}
              iconColor="#F44336"
              testID={`delete-budget-${budget.id}`}
            />
          </View>
        </View>

        {/* Spending info */}
        <Text style={styles.spendingText}>
          已花费 ¥{formatAmount(spending)} / 预算 ¥{formatAmount(effectiveBudget)}
        </Text>

        {/* Progress bar */}
        <View style={styles.progressContainer} testID={`progress-bar-${budget.id}`}>
          <View
            style={[
              styles.progressBar,
              { width: barWidth, backgroundColor: barColor },
            ]}
          />
        </View>

        {/* Over-budget warning */}
        {isOverBudget ? (
          <Text style={styles.overBudgetText} testID={`over-budget-${budget.id}`}>
            超出预算 ¥{formatAmount(overspend)}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rolloverBadge: {
    fontSize: 12,
    color: '#2196F3',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spendingText: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 8,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  overBudgetText: {
    fontSize: 13,
    color: '#F44336',
    fontWeight: '500',
    marginTop: 6,
  },
});
