import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { TextInput, HelperText, Button, SegmentedButtons } from 'react-native-paper';
import { useCategoryStore } from '../stores/categoryStore';
import { useTransactionStore } from '../stores/transactionStore';
import { suggestCategory } from '../utils/autoCategorize';
import CategorySelector from './CategorySelector';
import { TransactionType, TransactionCreateInput } from '../database/types';

interface TransactionFormProps {
  onSuccess?: () => void;
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export default function TransactionForm({ onSuccess }: TransactionFormProps) {
  const db = useSQLiteContext();
  const { loadCategories } = useCategoryStore();
  const { addTransaction, submitting } = useTransactionStore();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  // Ref to always hold the latest type value, preventing stale closures in debounced callbacks
  const typeRef = useRef<TransactionType>('expense');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayString());

  const [amountError, setAmountError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    loadCategories(db);
  }, [db]);

  // Keep typeRef in sync with latest type so debounced callbacks always read the current value
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  // Auto-categorization: when description changes, try to suggest a category
  useEffect(() => {
    let cancelled = false;
    const suggest = async () => {
      if (!description || description.trim().length === 0) return;
      try {
        const result = await suggestCategory(db, description);
        if (!cancelled && result) {
          // Use typeRef.current (not the captured `type`) to avoid stale closure when
          // the user changes type during the 300ms debounce window
          if (result.category.type === typeRef.current) {
            setSelectedCategoryId(result.category.id);
            setCategoryError('');
          }
        }
      } catch {
        // Silently ignore auto-categorization errors
      }
    };
    const timeout = setTimeout(suggest, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [description]);

  // When type changes, clear category if it doesn't match the new type
  const handleTypeChange = useCallback((newType: string) => {
    const typedType = newType as TransactionType;
    setType(typedType);
    setSelectedCategoryId(null);
    setCategoryError('');
  }, []);

  const handleCategorySelect = useCallback(() => {
    setCategoryError('');
  }, []);

  const handleSubmit = async () => {
    let valid = true;

    // Validate amount
    if (!amount || amount.trim().length === 0) {
      setAmountError('请输入金额');
      valid = false;
    } else {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        setAmountError('请输入有效金额');
        valid = false;
      } else {
        setAmountError('');
      }
    }

    // Validate category
    if (selectedCategoryId === null) {
      setCategoryError('请选择分类');
      valid = false;
    } else {
      setCategoryError('');
    }

    // Validate date
    if (!date || !isValidDate(date)) {
      setDateError('请输入有效日期');
      valid = false;
    } else {
      setDateError('');
    }

    if (!valid) return;

    const input: TransactionCreateInput = {
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      type,
      category_id: selectedCategoryId!,
      description,
      date,
    };

    const result = await addTransaction(db, input);
    if (result) {
      // Reset form
      setAmount('');
      setType('expense');
      setSelectedCategoryId(null);
      setDescription('');
      setDate(getTodayString());
      setAmountError('');
      setCategoryError('');
      setDateError('');

      if (onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.typeToggle}>
        <SegmentedButtons
          value={type}
          onValueChange={handleTypeChange}
          buttons={[
            { value: 'expense', label: '支出' },
            { value: 'income', label: '收入' },
          ]}
        />
      </View>

      <TextInput
        label="金额"
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          if (amountError) setAmountError('');
        }}
        keyboardType="decimal-pad"
        error={!!amountError}
        mode="outlined"
        left={<TextInput.Affix text="¥" />}
        style={styles.input}
      />
      <HelperText type="error" visible={!!amountError}>
        {amountError}
      </HelperText>

      <CategorySelector
        type={type}
        selectedCategoryId={selectedCategoryId}
        onSelect={(category) => {
          setSelectedCategoryId(category.id);
          handleCategorySelect();
        }}
        error={categoryError}
      />

      <TextInput
        label="描述"
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        placeholder="输入描述可自动分类"
        style={styles.input}
      />

      <TextInput
        label="日期"
        value={date}
        onChangeText={(text) => {
          setDate(text);
          if (dateError) setDateError('');
        }}
        mode="outlined"
        placeholder="YYYY-MM-DD"
        error={!!dateError}
        style={styles.input}
      />
      <HelperText type="error" visible={!!dateError}>
        {dateError}
      </HelperText>

      <Button
        mode="contained"
        onPress={handleSubmit}
        disabled={submitting}
        loading={submitting}
        style={styles.submitButton}
        labelStyle={styles.submitButtonLabel}
      >
        {submitting ? '提交中...' : '记一笔'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typeToggle: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 2,
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 4,
  },
  submitButtonLabel: {
    fontSize: 16,
  },
});
