import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  FAB,
  Dialog,
  Portal,
  Button as PaperButton,
  ActivityIndicator,
} from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { useBudgetStore } from '../../src/stores/budgetStore';
import { useCategoryStore } from '../../src/stores/categoryStore';
import { useTransactionStore } from '../../src/stores/transactionStore';
import MonthSelector from '../../src/components/MonthSelector';
import BudgetProgressCard from '../../src/components/BudgetProgressCard';
import BudgetSettingDialog from '../../src/components/BudgetSettingDialog';
import { Budget, BudgetStatus, Category } from '../../src/database/types';

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
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

export default function BudgetScreen() {
  const db = useSQLiteContext();
  const {
    budgets,
    budgetStatuses,
    currentMonth,
    loading,
    loadBudgetData,
    addBudget,
    editBudget,
    removeBudget,
    setCurrentMonth,
  } = useBudgetStore();
  const { categories, loadCategories } = useCategoryStore();
  const { loadMonthlyData } = useTransactionStore();

  const [dialogVisible, setDialogVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Budget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const isCurrentMonth = currentMonth === getCurrentMonth();

  useEffect(() => {
    loadCategories(db);
  }, [db]);

  useEffect(() => {
    loadBudgetData(db, currentMonth);
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

  const handleOpenAddDialog = useCallback(() => {
    setEditTarget(null);
    setDialogVisible(true);
  }, []);

  const handleOpenEditDialog = useCallback((budget: Budget) => {
    setEditTarget(budget);
    setDialogVisible(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogVisible(false);
    setEditTarget(null);
  }, []);

  const handleSaveBudget = useCallback(
    async (params: {
      categoryId: number | null;
      amount: number;
      rolloverEnabled: boolean;
    }) => {
      if (editTarget) {
        await editBudget(db, editTarget.id, {
          amount: params.amount,
          rollover_enabled: params.rolloverEnabled ? 1 : 0,
        });
      } else {
        await addBudget(db, {
          month: currentMonth,
          category_id: params.categoryId,
          amount: params.amount,
          rollover_enabled: params.rolloverEnabled ? 1 : 0,
        });
      }
      await loadBudgetData(db, currentMonth);
    },
    [db, editTarget, currentMonth, editBudget, addBudget, loadBudgetData]
  );

  const handleDeletePress = useCallback((budget: Budget) => {
    setDeleteTarget(budget);
    setDeleteDialogVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteTarget) {
      await removeBudget(db, deleteTarget.id);
    }
    setDeleteDialogVisible(false);
    setDeleteTarget(null);
  }, [db, deleteTarget, removeBudget]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogVisible(false);
    setDeleteTarget(null);
  }, []);

  // Get expense categories not already budgeted
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const budgetedCategoryIds = new Set(
    budgets
      .filter((b) => b.category_id !== null)
      .map((b) => b.category_id as number)
  );
  const availableCategories = expenseCategories.filter(
    (c) => !budgetedCategoryIds.has(c.id)
  );

  // Split statuses into total and per-category
  const totalStatus = budgetStatuses.find((s) => s.budget.category_id === null);
  const categoryStatuses = budgetStatuses.filter(
    (s) => s.budget.category_id !== null
  );

  const getCategoryForStatus = useCallback(
    (status: BudgetStatus): Category | undefined => {
      if (status.budget.category_id === null) return undefined;
      return categories.find((c) => c.id === status.budget.category_id);
    },
    [categories]
  );

  const hasBudgets = budgets.length > 0;

  return (
    <View style={styles.container}>
      {/* Month Selector */}
      <MonthSelector
        month={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        isCurrentMonth={isCurrentMonth}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : !hasBudgets ? (
        /* Empty state */
        <View style={styles.emptyState} testID="empty-state">
          <Text style={styles.emptyText}>暂无预算，点击添加</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Total budget card */}
          {totalStatus ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>月度总预算</Text>
              <BudgetProgressCard
                status={totalStatus}
                onEdit={() => handleOpenEditDialog(totalStatus.budget)}
                onDelete={() => handleDeletePress(totalStatus.budget)}
              />
            </View>
          ) : null}

          {/* Per-category budget cards */}
          {categoryStatuses.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>分类预算</Text>
              {categoryStatuses.map((status) => {
                const cat = getCategoryForStatus(status);
                return (
                  <BudgetProgressCard
                    key={status.budget.id}
                    status={status}
                    categoryName={cat?.name}
                    categoryIcon={cat?.icon}
                    categoryColor={cat?.color}
                    onEdit={() => handleOpenEditDialog(status.budget)}
                    onDelete={() => handleDeletePress(status.budget)}
                  />
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* FAB for adding budget */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleOpenAddDialog}
        label="添加预算"
        testID="add-budget-fab"
      />

      {/* Budget Setting Dialog */}
      <BudgetSettingDialog
        visible={dialogVisible}
        onDismiss={handleCloseDialog}
        onSave={handleSaveBudget}
        editBudget={editTarget}
        availableCategories={availableCategories}
        isEditMode={!!editTarget}
      />

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={handleDeleteCancel}
          testID="delete-dialog"
        >
          <Dialog.Title>确认删除</Dialog.Title>
          <Dialog.Content>
            <Text>确定要删除此预算吗？删除后不可恢复。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={handleDeleteCancel} testID="cancel-delete-button">
              取消
            </PaperButton>
            <PaperButton
              onPress={handleDeleteConfirm}
              textColor="#F44336"
              testID="confirm-delete-button"
            >
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    opacity: 0.5,
    marginHorizontal: 20,
    marginBottom: 4,
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
