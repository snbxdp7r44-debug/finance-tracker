import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import {
  Dialog,
  Portal,
  Button as PaperButton,
  TextInput,
  HelperText,
  Switch,
  Divider,
} from 'react-native-paper';
import { Budget, Category } from '../database/types';
import CategoryIcon from './CategoryIcon';

interface BudgetSettingDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (params: {
    categoryId: number | null;
    amount: number;
    rolloverEnabled: boolean;
  }) => Promise<void>;
  editBudget?: Budget | null; // existing budget for edit mode
  availableCategories: Category[]; // expense categories not yet budgeted
  isEditMode?: boolean;
}

export default function BudgetSettingDialog({
  visible,
  onDismiss,
  onSave,
  editBudget,
  availableCategories,
  isEditMode = false,
}: BudgetSettingDialogProps) {
  const [amount, setAmount] = useState('');
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isTotalBudget, setIsTotalBudget] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (visible) {
      if (editBudget) {
        setAmount(editBudget.amount.toString());
        setRolloverEnabled(editBudget.rollover_enabled === 1);
        setSelectedCategoryId(editBudget.category_id);
        setIsTotalBudget(editBudget.category_id === null);
      } else {
        setAmount('');
        setRolloverEnabled(false);
        setSelectedCategoryId(null);
        setIsTotalBudget(false);
      }
      setAmountError('');
      setCategoryError('');
    }
  }, [visible, editBudget]);

  const validateAmount = (value: string): boolean => {
    if (!value || value.trim() === '') {
      setAmountError('请输入金额');
      return false;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      setAmountError('请输入有效数字');
      return false;
    }
    if (num <= 0) {
      setAmountError('金额必须大于0');
      return false;
    }
    setAmountError('');
    return true;
  };

  const validateCategory = (): boolean => {
    if (!isEditMode && !isTotalBudget && selectedCategoryId === null) {
      setCategoryError('请选择分类');
      return false;
    }
    setCategoryError('');
    return true;
  };

  const handleSave = async () => {
    const amountValid = validateAmount(amount);
    const categoryValid = isEditMode || isTotalBudget ? true : validateCategory();

    if (!amountValid || !categoryValid) return;

    const numAmount = parseFloat(amount);
    let finalCategoryId: number | null;

    if (isEditMode && editBudget) {
      finalCategoryId = editBudget.category_id;
    } else if (isTotalBudget) {
      finalCategoryId = null;
    } else {
      finalCategoryId = selectedCategoryId;
    }

    setSaving(true);
    try {
      await onSave({
        categoryId: finalCategoryId,
        amount: numAmount,
        rolloverEnabled,
      });
      onDismiss();
    } finally {
      setSaving(false);
    }
  };

  const handleAmountChange = (text: string) => {
    // Only allow numeric input with at most one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setAmount(normalized);
    if (amountError) {
      validateAmount(normalized);
    }
  };

  const dialogTitle = isEditMode ? '编辑预算' : '添加预算';

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{dialogTitle}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <View style={styles.content}>
              {/* Budget type selection (add mode only) */}
              {!isEditMode ? (
                <View style={styles.typeSection}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      isTotalBudget && styles.typeButtonSelected,
                    ]}
                    onPress={() => {
                      setIsTotalBudget(true);
                      setSelectedCategoryId(null);
                      setCategoryError('');
                    }}
                    testID="total-budget-button"
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        isTotalBudget && styles.typeButtonTextSelected,
                      ]}
                    >
                      总预算
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      !isTotalBudget && styles.typeButtonSelected,
                    ]}
                    onPress={() => {
                      setIsTotalBudget(false);
                    }}
                    testID="category-budget-button"
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        !isTotalBudget && styles.typeButtonTextSelected,
                      ]}
                    >
                      按分类
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Category selector (add mode, per-category) */}
              {!isEditMode && !isTotalBudget ? (
                <View style={styles.categorySection}>
                  <Text style={styles.sectionLabel}>选择分类</Text>
                  {availableCategories.length === 0 ? (
                    <Text style={styles.noCategoryText}>
                      所有支出分类都已设置预算
                    </Text>
                  ) : (
                    <View style={styles.categoryGrid}>
                      {availableCategories.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryItem,
                            selectedCategoryId === cat.id &&
                              styles.categoryItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedCategoryId(cat.id);
                            setCategoryError('');
                          }}
                          testID={`category-item-${cat.id}`}
                        >
                          <CategoryIcon
                            iconName={cat.icon}
                            color={cat.color}
                            size={18}
                            label={cat.name}
                            showLabel
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {categoryError ? (
                    <Text style={styles.errorText}>{categoryError}</Text>
                  ) : null}
                </View>
              ) : null}

              <Divider style={styles.divider} />

              {/* Amount input */}
              <TextInput
                label="预算金额（元）"
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.amountInput}
                error={!!amountError}
                testID="amount-input"
              />
              {amountError ? (
                <HelperText type="error">{amountError}</HelperText>
              ) : null}

              {/* Rollover toggle */}
              <View style={styles.rolloverRow}>
                <View style={styles.rolloverTextContainer}>
                  <Text style={styles.rolloverLabel}>结转未用预算</Text>
                  <Text style={styles.rolloverDesc}>
                    开启后，上月未用完的预算将累计到本月
                  </Text>
                </View>
                <Switch
                  value={rolloverEnabled}
                  onValueChange={setRolloverEnabled}
                  testID="rollover-switch"
                />
              </View>
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <PaperButton onPress={onDismiss} disabled={saving}>
            取消
          </PaperButton>
          <PaperButton
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            testID="save-budget-button"
          >
            保存
          </PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  typeSection: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  typeButtonSelected: {
    borderColor: '#6200ee',
    backgroundColor: '#6200ee15',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#757575',
  },
  typeButtonTextSelected: {
    color: '#6200ee',
    fontWeight: '600',
  },
  categorySection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    width: 72,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryItemSelected: {
    borderColor: '#6200ee',
    backgroundColor: '#6200ee10',
  },
  noCategoryText: {
    fontSize: 13,
    opacity: 0.5,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  divider: {
    marginVertical: 12,
  },
  amountInput: {
    marginBottom: 4,
  },
  rolloverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  rolloverTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  rolloverLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rolloverDesc: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
});
