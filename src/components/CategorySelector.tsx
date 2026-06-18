import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Chip, Divider, TextInput, HelperText } from 'react-native-paper';
import { useCategoryStore } from '../stores/categoryStore';
import { Category, TransactionType } from '../database/types';
import CategoryIcon from './CategoryIcon';

interface CategorySelectorProps {
  type: TransactionType;
  selectedCategoryId?: number | null;
  onSelect: (category: Category) => void;
  error?: string;
}

export default function CategorySelector({ type, selectedCategoryId, onSelect, error }: CategorySelectorProps) {
  const db = useSQLiteContext();
  const { categories, loadCategories, getCategory } = useCategoryStore();

  useEffect(() => {
    loadCategories(db);
  }, [db]);

  const defaultCategories = categories.filter(
    (c) => c.type === type && c.is_default === 1
  );
  const customCategories = categories.filter(
    (c) => c.type === type && c.is_default === 0
  );

  const selectedCategory = selectedCategoryId ? getCategory(selectedCategoryId) : null;

  const renderCategoryItem = useCallback(
    ({ item }: { item: Category }) => {
      const isSelected = item.id === selectedCategoryId;
      return (
        <TouchableOpacity
          style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
          onPress={() => onSelect(item)}
          activeOpacity={0.7}
        >
          <CategoryIcon
            iconName={item.icon}
            color={item.color}
            size={20}
            label={item.name}
            showLabel
          />
        </TouchableOpacity>
      );
    },
    [selectedCategoryId, onSelect]
  );

  const renderSection = useCallback(
    (title: string, data: Category[]) => {
      if (data.length === 0) return null;
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.grid}>
            {data.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.categoryItem,
                  item.id === selectedCategoryId && styles.categoryItemSelected,
                ]}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <CategoryIcon
                  iconName={item.icon}
                  color={item.color}
                  size={20}
                  label={item.name}
                  showLabel
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    },
    [selectedCategoryId, onSelect]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>分类</Text>
      {selectedCategory ? (
        <View style={styles.selectedChip}>
          <CategoryIcon
            iconName={selectedCategory.icon}
            color={selectedCategory.color}
            size={18}
          />
          <Text style={[styles.selectedName, { color: selectedCategory.color }]}>
            {selectedCategory.name}
          </Text>
        </View>
      ) : null}
      {renderSection('预设分类', defaultCategories)}
      {customCategories.length > 0
        ? renderSection('自定义分类', customCategories)
        : null}
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.7,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 8,
  },
  grid: {
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
});
