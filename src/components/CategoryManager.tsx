import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Text,
  Card,
  Button,
  IconButton,
  Dialog,
  Portal,
  TextInput,
  HelperText,
  Chip,
  FAB,
  SegmentedButtons,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCategoryStore } from '../stores/categoryStore';
import { useCategoryRuleStore } from '../stores/categoryRuleStore';
import { Category, TransactionType, CategoryCreateInput, CategoryRule } from '../database/types';
import CategoryIcon from './CategoryIcon';

// Available icons for custom categories
const AVAILABLE_ICONS = [
  'food', 'car', 'cart', 'gamepad-variant', 'home', 'medical-bag',
  'school', 'cellphone', 'cash', 'gift', 'chart-line', 'briefcase',
  'pets', 'baby', 'shoe-form', 'palette', 'music', 'book-open-variant',
  'airplane', 'camera', 'dumbbell', 'flower', 'heart', 'star',
  'coffee', 'pizza', 'ice-cream', 'basketball', 'swim', 'bike',
];

// Available colors for custom categories
const AVAILABLE_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFC107', '#FF9800', '#FF5722', '#795548',
  '#607D8B', '#E8D5B7', '#B0BEC5', '#90A4AE',
];

export default function CategoryManager() {
  const db = useSQLiteContext();
  const {
    categories,
    loadCategories,
    addCategory,
    editCategory,
    removeCategory,
    forceRemoveCategory,
    checkNameUnique,
    error: categoryError,
    clearError: clearCategoryError,
  } = useCategoryStore();

  const {
    rules,
    loadRules,
    addRule,
    editRule,
    removeRule,
    getRulesForCategory,
    error: ruleError,
    clearError: clearRuleError,
  } = useCategoryRuleStore();

  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showKeywordDialog, setShowKeywordDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [keywordEditingCategory, setKeywordEditingCategory] = useState<Category | null>(null);

  // Add/Edit form state
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('star');
  const [formColor, setFormColor] = useState('#607D8B');
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formError, setFormError] = useState('');

  // Keyword form state
  const [newKeyword, setNewKeyword] = useState('');
  const [keywordError, setKeywordError] = useState('');

  useEffect(() => {
    loadCategories(db);
    loadRules(db);
  }, [db]);

  const filteredCategories = categories.filter((c) => c.type === selectedType);
  const defaultCategories = filteredCategories.filter((c) => c.is_default === 1);
  const customCategories = filteredCategories.filter((c) => c.is_default === 0);

  const resetForm = () => {
    setFormName('');
    setFormIcon('star');
    setFormColor('#607D8B');
    setFormType(selectedType);
    setFormError('');
  };

  const handleAdd = () => {
    resetForm();
    setFormType(selectedType);
    setShowAddDialog(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormIcon(category.icon);
    setFormColor(category.color);
    setFormType(category.type);
    setFormError('');
    setShowEditDialog(true);
  };

  const handleDelete = (category: Category) => {
    if (category.is_default === 1) return;

    useCategoryStore.getState().removeCategory(db, category.id).then((result) => {
      if (result.inUse) {
        Alert.alert(
          '删除分类',
          `该分类下有 ${result.transactionCount} 条记录，确定删除？`,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '删除',
              style: 'destructive',
              onPress: () => {
                useCategoryStore.getState().forceRemoveCategory(db, category.id);
              },
            },
          ]
        );
      } else if (!result.success && useCategoryStore.getState().error) {
        Alert.alert('错误', useCategoryStore.getState().error!);
      }
    });
  };

  const handleKeywordEdit = (category: Category) => {
    setKeywordEditingCategory(category);
    setNewKeyword('');
    setKeywordError('');
    setShowKeywordDialog(true);
  };

  const validateAndSubmitAdd = async () => {
    if (!formName.trim()) {
      setFormError('请输入分类名称');
      return;
    }

    const isUnique = await checkNameUnique(db, formName.trim());
    if (!isUnique) {
      setFormError('分类已存在');
      return;
    }

    const input: CategoryCreateInput = {
      name: formName.trim(),
      icon: formIcon,
      color: formColor,
      type: formType,
    };

    const result = await addCategory(db, input);
    if (result) {
      setShowAddDialog(false);
      resetForm();
    }
  };

  const validateAndSubmitEdit = async () => {
    if (!editingCategory) return;
    if (!formName.trim()) {
      setFormError('请输入分类名称');
      return;
    }

    if (formName.trim() !== editingCategory.name) {
      const isUnique = await checkNameUnique(db, formName.trim(), editingCategory.id);
      if (!isUnique) {
        setFormError('分类已存在');
        return;
      }
    }

    const success = await editCategory(db, editingCategory.id, {
      name: formName.trim(),
      icon: formIcon,
      color: formColor,
    });

    if (success) {
      setShowEditDialog(false);
      setEditingCategory(null);
    } else {
      const err = useCategoryStore.getState().error;
      if (err) setFormError(err);
    }
  };

  const handleAddKeyword = async () => {
    if (!keywordEditingCategory) return;
    if (!newKeyword.trim()) {
      setKeywordError('请输入关键词');
      return;
    }

    const result = await addRule(db, {
      category_id: keywordEditingCategory.id,
      keyword: newKeyword.trim(),
      priority: 0,
    });

    if (result) {
      setNewKeyword('');
      setKeywordError('');
    } else {
      const err = useCategoryRuleStore.getState().error;
      if (err) setKeywordError(err);
    }
  };

  const handleDeleteKeyword = async (ruleId: number) => {
    await removeRule(db, ruleId);
  };

  const renderCategoryItem = ({ item: category }: { item: Category }) => {
    const isDefault = category.is_default === 1;
    const categoryRules = getRulesForCategory(category.id);

    return (
      <Card style={styles.categoryCard} mode="outlined">
        <Card.Content style={styles.cardContent}>
          <View style={styles.categoryInfo}>
            <CategoryIcon iconName={category.icon} color={category.color} size={22} />
            <Text style={styles.categoryName}>{category.name}</Text>
            <Text style={styles.categoryType}>
              {category.type === 'expense' ? '支出' : '收入'}
            </Text>
          </View>
          <View style={styles.actions}>
            <IconButton
              icon="tag-text"
              size={20}
              onPress={() => handleKeywordEdit(category)}
            />
            {!isDefault && (
              <>
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={() => handleEdit(category)}
                />
                <IconButton
                  icon="delete"
                  size={20}
                  iconColor="#F44336"
                  onPress={() => handleDelete(category)}
                />
              </>
            )}
          </View>
        </Card.Content>
        {categoryRules.length > 0 && (
          <Card.Content style={styles.keywordsRow}>
            <Text style={styles.keywordsLabel}>关键词：</Text>
            <View style={styles.keywordsWrap}>
              {categoryRules.map((rule) => (
                <Chip
                  key={rule.id}
                  mode="outlined"
                  textStyle={{ fontSize: 11 }}
                  style={styles.keywordChip}
                  onClose={isDefault ? undefined : () => handleDeleteKeyword(rule.id)}
                >
                  {rule.keyword}
                </Chip>
              ))}
            </View>
          </Card.Content>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={selectedType}
        onValueChange={(val) => setSelectedType(val as TransactionType)}
        buttons={[
          { value: 'expense', label: '支出分类' },
          { value: 'income', label: '收入分类' },
        ]}
        style={styles.segmented}
      />

      <ScrollView style={styles.listContainer}>
        {defaultCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>预设分类</Text>
            {defaultCategories.map((cat) => (
              <View key={cat.id}>{renderCategoryItem({ item: cat })}</View>
            ))}
          </View>
        )}

        {customCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>自定义分类</Text>
            {customCategories.map((cat) => (
              <View key={cat.id}>{renderCategoryItem({ item: cat })}</View>
            ))}
          </View>
        )}

        {filteredCategories.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>暂无分类</Text>
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAdd}
        label="添加分类"
      />

      {/* Add Category Dialog */}
      <Portal>
        <Dialog visible={showAddDialog} onDismiss={() => setShowAddDialog(false)}>
          <Dialog.Title>添加分类</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="分类名称"
              value={formName}
              onChangeText={setFormName}
              error={!!formError}
              maxLength={20}
            />
            <HelperText type="error" visible={!!formError}>
              {formError}
            </HelperText>

            <Text style={styles.pickerLabel}>选择图标</Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconPickerItem,
                    formIcon === icon && styles.iconPickerItemSelected,
                  ]}
                  onPress={() => setFormIcon(icon)}
                >
                  <MaterialCommunityIcons name={icon as any} size={24} color={formIcon === icon ? '#6200ee' : '#666'} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.pickerLabel}>选择颜色</Text>
            <View style={styles.colorGrid}>
              {AVAILABLE_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorPickerItem,
                    { backgroundColor: color },
                    formColor === color && styles.colorPickerItemSelected,
                  ]}
                  onPress={() => setFormColor(color)}
                />
              ))}
            </View>

            <Text style={styles.pickerLabel}>分类类型</Text>
            <SegmentedButtons
              value={formType}
              onValueChange={(val) => setFormType(val as TransactionType)}
              buttons={[
                { value: 'expense', label: '支出' },
                { value: 'income', label: '收入' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddDialog(false)}>取消</Button>
            <Button onPress={validateAndSubmitAdd}>确定</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Category Dialog */}
      <Portal>
        <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)}>
          <Dialog.Title>编辑分类</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="分类名称"
              value={formName}
              onChangeText={setFormName}
              error={!!formError}
              maxLength={20}
            />
            <HelperText type="error" visible={!!formError}>
              {formError}
            </HelperText>

            <Text style={styles.pickerLabel}>选择图标</Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconPickerItem,
                    formIcon === icon && styles.iconPickerItemSelected,
                  ]}
                  onPress={() => setFormIcon(icon)}
                >
                  <MaterialCommunityIcons name={icon as any} size={24} color={formIcon === icon ? '#6200ee' : '#666'} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.pickerLabel}>选择颜色</Text>
            <View style={styles.colorGrid}>
              {AVAILABLE_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorPickerItem,
                    { backgroundColor: color },
                    formColor === color && styles.colorPickerItemSelected,
                  ]}
                  onPress={() => setFormColor(color)}
                />
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEditDialog(false)}>取消</Button>
            <Button onPress={validateAndSubmitEdit}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Keyword Editing Dialog */}
      <Portal>
        <Dialog visible={showKeywordDialog} onDismiss={() => setShowKeywordDialog(false)}>
          <Dialog.Title>
            {keywordEditingCategory ? `${keywordEditingCategory.name} - 关键词管理` : '关键词管理'}
          </Dialog.Title>
          <Dialog.Content>
            <View style={styles.keywordInputRow}>
              <TextInput
                label="添加关键词"
                value={newKeyword}
                onChangeText={setNewKeyword}
                error={!!keywordError}
                style={styles.keywordInput}
                onSubmitEditing={handleAddKeyword}
                maxLength={20}
              />
              <IconButton icon="plus-circle" size={28} onPress={handleAddKeyword} />
            </View>
            <HelperText type="error" visible={!!keywordError}>
              {keywordError}
            </HelperText>

            <Text style={styles.keywordsListTitle}>现有关键词</Text>
            <View style={styles.keywordsList}>
              {keywordEditingCategory &&
                getRulesForCategory(keywordEditingCategory.id).map((rule) => (
                  <Chip
                    key={rule.id}
                    mode="outlined"
                    style={styles.keywordChip}
                    onClose={() => handleDeleteKeyword(rule.id)}
                  >
                    {rule.keyword}
                  </Chip>
                ))}
              {keywordEditingCategory &&
                getRulesForCategory(keywordEditingCategory.id).length === 0 && (
                  <Text style={styles.noKeywords}>暂无关键词</Text>
                )}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowKeywordDialog(false)}>关闭</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  segmented: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
  },
  categoryCard: {
    marginBottom: 8,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  categoryType: {
    fontSize: 12,
    marginLeft: 8,
    opacity: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keywordsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginTop: -4,
  },
  keywordsLabel: {
    fontSize: 12,
    color: '#999',
    marginRight: 4,
    marginTop: 4,
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 4,
  },
  keywordChip: {
    height: 28,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  pickerLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  iconPickerItem: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconPickerItemSelected: {
    borderColor: '#6200ee',
    backgroundColor: '#6200ee10',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorPickerItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPickerItemSelected: {
    borderColor: '#333',
    borderWidth: 3,
  },
  keywordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keywordInput: {
    flex: 1,
  },
  keywordsListTitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  keywordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  noKeywords: {
    fontSize: 14,
    opacity: 0.5,
    fontStyle: 'italic',
  },
});
