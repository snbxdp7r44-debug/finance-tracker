import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { IconButton, Card, Divider, Dialog, Portal, Button as PaperButton } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { useTransactionStore } from '../../src/stores/transactionStore';
import { useCategoryStore } from '../../src/stores/categoryStore';
import CategoryIcon from '../../src/components/CategoryIcon';
import { Transaction } from '../../src/database/types';

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${year}年${parseInt(m)}月`;
}

function getPrevMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  if (m === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(m - 1).padStart(2, '0')}`;
}

function getNextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  if (m === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(m + 1).padStart(2, '0')}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const {
    transactions,
    monthlyTotals,
    currentMonth,
    loadMonthlyData,
    removeTransaction,
    setCurrentMonth,
  } = useTransactionStore();
  const { loadCategories, getCategory } = useCategoryStore();
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const isCurrentMonth = currentMonth === getCurrentMonth();

  useEffect(() => {
    loadCategories(db);
  }, [db]);

  useEffect(() => {
    loadMonthlyData(db, currentMonth);
  }, [db, currentMonth]);

  const handlePrevMonth = useCallback(() => {
    const prev = getPrevMonth(currentMonth);
    setCurrentMonth(prev);
  }, [currentMonth, setCurrentMonth]);

  const handleNextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    const next = getNextMonth(currentMonth);
    setCurrentMonth(next);
  }, [currentMonth, isCurrentMonth, setCurrentMonth]);

  const handleDeletePress = useCallback((transaction: Transaction) => {
    setDeleteTarget(transaction);
    setDeleteDialogVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteTarget) {
      await removeTransaction(db, deleteTarget.id);
    }
    setDeleteDialogVisible(false);
    setDeleteTarget(null);
  }, [db, deleteTarget, removeTransaction]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogVisible(false);
    setDeleteTarget(null);
  }, []);

  const netBalance = monthlyTotals.income - monthlyTotals.expense;

  const renderTransactionItem = useCallback(
    ({ item }: { item: Transaction }) => {
      const category = getCategory(item.category_id);
      const isIncome = item.type === 'income';
      const amountColor = isIncome ? '#4CAF50' : '#F44336';
      const amountPrefix = isIncome ? '+' : '-';

      return (
        <TouchableOpacity
          style={styles.transactionItem}
          onLongPress={() => handleDeletePress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.transactionLeft}>
            <CategoryIcon
              iconName={category?.icon ?? item.category_icon ?? 'circle'}
              color={category?.color ?? item.category_color ?? '#607D8B'}
              size={18}
            />
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionCategory}>
                {category?.name ?? item.category_name ?? ''}
              </Text>
              {item.description ? (
                <Text style={styles.transactionDescription} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.transactionRight}>
            <Text style={[styles.transactionAmount, { color: amountColor }]}>
              {amountPrefix}¥{formatAmount(item.amount)}
            </Text>
            <Text style={styles.transactionDate}>{item.date}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [getCategory, handleDeletePress]
  );

  const renderEmptyState = useCallback(() => {
    if (transactions.length > 0) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>暂无记录</Text>
      </View>
    );
  }, [transactions.length]);

  return (
    <View style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <IconButton
          icon="chevron-left"
          size={24}
          onPress={handlePrevMonth}
        />
        <Text style={styles.monthLabel}>{formatMonthLabel(currentMonth)}</Text>
        <IconButton
          icon="chevron-right"
          size={24}
          onPress={handleNextMonth}
          disabled={isCurrentMonth}
        />
      </View>

      {/* Monthly Summary Cards */}
      <View style={styles.summaryContainer}>
        <Card style={[styles.summaryCard, styles.incomeCard]}>
          <Card.Content style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>收入</Text>
            <Text style={styles.summaryAmount}>¥{formatAmount(monthlyTotals.income)}</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, styles.expenseCard]}>
          <Card.Content style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>支出</Text>
            <Text style={styles.summaryAmount}>¥{formatAmount(monthlyTotals.expense)}</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Net Balance */}
      <Card style={styles.balanceCard}>
        <Card.Content style={styles.balanceContent}>
          <Text style={styles.balanceLabel}>结余</Text>
          <Text
            style={[
              styles.balanceAmount,
              { color: netBalance >= 0 ? '#4CAF50' : '#F44336' },
            ]}
          >
            {netBalance >= 0 ? '' : '-'}¥{formatAmount(Math.abs(netBalance))}
          </Text>
        </Card.Content>
      </Card>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTransactionItem}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={transactions.length === 0 ? styles.emptyList : styles.transactionList}
      />

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={handleDeleteCancel}>
          <Dialog.Title>确认删除</Dialog.Title>
          <Dialog.Content>
            <Text>确定要删除这条记录吗？删除后不可恢复。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={handleDeleteCancel}>取消</PaperButton>
            <PaperButton onPress={handleDeleteConfirm} textColor="#F44336">
              删除
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 120,
    textAlign: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
  },
  incomeCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  expenseCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    opacity: 0.6,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  balanceLabel: {
    fontSize: 14,
    opacity: 0.6,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  transactionList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.4,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionInfo: {
    marginLeft: 10,
    flex: 1,
  },
  transactionCategory: {
    fontSize: 15,
    fontWeight: '500',
  },
  transactionDescription: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 11,
    opacity: 0.4,
    marginTop: 2,
  },
});
