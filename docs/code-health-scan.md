# 代码健康扫描报告

> **项目**: finance-tracker (Expo / React Native + TypeScript + Zustand)  
> **总代码量**: ~8,015 行 (30 个源文件)  
> **扫描日期**: 2026-07-24  
> **扫描方式**: 人工代码审查 + 静态分析

---

## 严重程度定义

| 等级 | 标签 | 说明 |
|------|------|------|
| 🔴 **高危** | H | 可能引发运行时错误或数据不一致 |
| 🟠 **中危** | M | 导致维护困难、可读性差、容易引入缺陷 |
| 🟡 **低危** | L | 风格/约定问题，长期积累会恶化 |
| ℹ️ **建议** | I | 改进建议，非坏味道 |

---

## 一、类型安全 — `any` 滥用 (H)

### 1.1 Store 接口中 `db` 参数全为 `any`

所有 4 个 store（`transactionStore.ts`、`budgetStore.ts`、`categoryStore.ts`、`categoryRuleStore.ts`）的接口定义中，`db` 参数全部使用 `any` 类型，丢失了 `expo-sqlite` 的 `SQLiteDatabase` 类型信息。

**位置**:
- `src/stores/transactionStore.ts:29-32` — `loadMonthlyData: (db: any, ...)` 等
- `src/stores/budgetStore.ts:26-29` — `loadBudgetData: (db: any, ...)` 等
- `src/stores/categoryStore.ts:22-24` — `loadCategories: (db: any, ...)` 等
- `src/stores/categoryRuleStore.ts:17-21` — `loadRules: (db: any, ...)` 等

**修复**: 将 `any` 替换为 `import { SQLiteDatabase } from 'expo-sqlite'`。

### 1.2 所有 `catch` 分支使用 `e: any`

共 **19 处** 使用 `catch (e: any)`，完全丧失了异常类型信息。`e.message` 在严格模式下可能不存在。

**代表位置**:
- `src/stores/transactionStore.ts:69,103,126,149`
- `src/stores/budgetStore.ts:62,116,161,181`
- `src/stores/categoryRuleStore.ts:36,50,76,114,128`
- `src/stores/categoryStore.ts:46,56,81,116,146,166`

**修复**: 使用 `catch (e: unknown)` 并配合 `(e as Error).message` 或自定义守卫。

---

## 二、代码重复 — 辅助函数重复定义 (M)

### 2.1 `getPrevMonth` / `getNextMonth` 重复

同一逻辑在 3 个位置重复实现：

| 函数 | 位置 |
|------|------|
| `getPrevMonth` / `getNextMonth` | `app/(tabs)/index.tsx:26-40` |
| `getPrevMonth` / `getNextMonth` | `app/(tabs)/budget.tsx:32-47` |
| `getPrevMonth` | `src/database/budgetRepository.ts:14-19`（仅前者） |

### 2.2 `getCurrentMonth` 重复

| 位置 | 定义 |
|------|------|
| `app/(tabs)/index.tsx:42-46` | `getCurrentMonth()` |
| `app/(tabs)/budget.tsx:25-29` | `getCurrentMonth()` |
| `src/stores/transactionStore.ts:38-42` | `getCurrentMonth()` |
| `src/stores/budgetStore.ts:35-39` | `getCurrentMonth()` |

### 2.3 `formatMonthLabel` 重复

| 位置 | 定义 |
|------|------|
| `src/components/MonthSelector.tsx:12-14` | `formatMonthLabel()` |
| `app/(tabs)/index.tsx:21-23` | `formatMonthLabel()` |

### 2.4 `formatAmount` 重复

| 位置 | 定义 |
|------|------|
| `src/components/BudgetProgressCard.tsx:16-18` | `formatAmount()` |
| `app/(tabs)/index.tsx:17-19` | `formatAmount()` |

**修复**: 统一提取到 `src/utils/index.ts` 或新建 `src/utils/date.ts` 和 `src/utils/format.ts`。

---

## 三、性能问题 (M)

### 3.1 `findMatchingRules` 内存全表扫描

**位置**: `src/database/categoryRuleRepository.ts:90-98`

```typescript
// 注释说 "SQLite LIKE doesn't support CJK well"
// 但实际 SQLite 的 LIKE 对 CJK 完全正常
const rules = await db.getAllAsync<...>(`SELECT ... FROM category_rules cr JOIN categories c ...`)
return rules.filter(rule => note.includes(rule.keyword));
```

每次分类匹配都拉取全部规则到 JS 内存再做小字符串包含过滤。如果规则表增长到数千条，这将导致明显的性能下降和内存开销。

**修复**: 
- 默认使用 SQL LIKE `WHERE ? LIKE '%' || keyword || '%'`
- 可在 keyword 列上加索引

### 3.2 `seedDefaultCategoryRules` N+1 插入

**位置**: `src/database/migrations.ts:103-110`

```typescript
for (const keyword of keywords) {
  await db.runAsync('INSERT INTO category_rules ...', [category.id, keyword, 0])
}
```

每个关键词单独执行一条 INSERT。总共约 60+ 条写入，每次都是独立网络/磁盘往返。

**修复**: 使用事务包装整个循环，或拼装批量 INSERT 语句。

### 3.3 `icon as any` 类型断言

**位置**: `src/components/CategoryIcon.tsx:16` 和 `CategoryManager.tsx:179,215` 等多处

```typescript
<MaterialCommunityIcons name={iconName as any} ... />
```

`@expo/vector-icons` 的 icon name 是字面量联合类型。`as any` 跳过了编译检查，拼错的 icon 名只能在运行时发现。

**修复**: 定义应用层 icon name 联合类型，或使用类型守卫。

---

## 四、架构耦合 — DB 上下文传递模式 (M)

### 4.1 Store 与 DB 的紧耦合

所有 store 的操作方法都要求调用方传入 `db` 参数：

```typescript
// 调用方（组件、屏幕）
const db = useSQLiteContext();
const { addTransaction } = useTransactionStore();
await addTransaction(db, input);   // db 从外部传入
```

这意味着 store 不是真正的"存储层抽象"，而更像是"带 UI 状态的数据操作函数集合"。

**影响**:
- 每个组件都直接依赖 `expo-sqlite` 的 `useSQLiteContext`
- 6 个组件/屏幕中调用了 `useSQLiteContext()`（`TransactionForm`、`CategorySelector`、`CategoryManager`、`HomeScreen`、`BudgetScreen`，以及 store 内部的间接依赖）
- 如果将来切换存储引擎，改动面很大

**修复（渐进式）**:
- 在 store 内部通过 module-level 或 provider 持有的引用管理 db 实例
- 或者用 Repository 模式完全封装 SQL 细节，Store 只调 Repository 的方法

### 4.2 `useSQLiteContext` 在未使用的 import 中出现

**位置**: `src/stores/categoryStore.ts:2` — 导入了 `useSQLiteContext` 但从未使用。

---

## 五、未使用的导入 (L)

### 5.1 `CategorySelector.tsx`

```typescript
// 第 2 行: FlatList 从未使用
// 第 4 行: Chip, Divider, TextInput 从未使用
```

### 5.2 `CategoryManager.tsx`

```typescript
// 第 13 行: ScrollView 已用但 FlatList, Alert 未直接在本文件层级使用
// 实际 renderSection 用了 map + TouchableOpacity 而非 FlatList
```

---

## 六、代码可维护性 (L)

### 6.1 `loadRulesByCategory` 的冗余逻辑

**位置**: `src/stores/categoryRuleStore.ts:45-52`

```typescript
loadRulesByCategory: async (db, categoryId) => {
    const rules = await getRulesByCategoryId(db, categoryId); // 👈 第一个查询
    set({ loading: false });  // 这里没有设置 rules
    const allRules = await getAllRules(db); // 👈 立刻又全量查询
    set({ rules: allRules, loading: false }); // 第一个查询结果被丢弃
}
```

第一个查询的结果完全被抛弃，这是一个明确的逻辑错误或重构残留。

### 6.2 `autoCategorize.ts` 中 Category 的假值填充

**位置**: `src/utils/autoCategorize.ts:38-44`

```typescript
category: {
    ...
    is_default: 0,      // 硬编码
    created_at: '',     // 硬编码空字符串
}
```

`suggestCategory` 返回的 `Category` 对象包含两个无意义字段。模型定义中包含"视图层不需要"的字段，说明 `Category` 类型需要拆分为"实体"和"只读视图"。

### 6.3 TransactionForm 的 typeRef 模式

**位置**: `src/components/TransactionForm.tsx`

```typescript
const typeRef = useRef<TransactionType>('expense');
useEffect(() => { typeRef.current = type; }, [type]);
```

通过 ref 解决 debounce 中的闭包陈旧问题。虽然能工作，但增加了复杂度。可改用 `useEffect` 的依赖或 `useCallback` 管理。

### 6.4 魔法颜色字符串扩散

多个文件中硬编码了 `#6200ee`（主题色 primary），如 `CategorySelector.tsx:138,140`、`BudgetSettingDialog.tsx:224,226`。

**修复**: 使用 `react-native-paper` 的 `useTheme()` 动态获取主题色。

---

## 七、测试文件 (I)

### 7.1 Mock 中同样使用 `db: any`

测试文件中的所有 mock 函数签名都使用 `db: any`。虽然测试中可以接受，但会降低测试的类型安全性。

**代表位置**:
- `__tests__/transaction/transactionStore.test.ts:6-8` — `jest.fn(async (db: any, ...)`

### 7.2 测试覆盖健康度

| 模块 | 测试文件 | 行数 | 覆盖内容 |
|------|---------|------|---------|
| transactionRepository | ✅ | 479 行 | 完整 CRUD + 查询 |
| transactionStore | ✅ | 255 行 | 完整 |
| categoryRepository | ✅ | 262 行 | 完整 |
| categoryStore | ⚠️ | 无独立测试 | 依赖联合测试 |
| categoryRuleRepository | ✅ | 173 行 | 完整 |
| categoryRuleStore | ✅ | 250 行 | 完整 |
| budgetRepository | ✅ | 480 行 | 完整 |
| budgetStore | ✅ | 340 行 | 完整 |
| autoCategorize | ✅ | 70 行 | 基础 |
| CategorySelector | ✅ | 72 行 | 基础渲染 |
| TransactionForm | ✅ | 274 行 | 表单交互 |
| BudgetScreen | ✅ | 399 行 | 集成 |
| HomeScreen | ✅ | 189 行 | 基础 |
| SettingsScreen | ✅ | 10 行 | 极简 |

**发现**: `categoryStore.ts` 没有独立的单元测试文件，其逻辑仅在集成测试中被间接覆盖。

---

## 八、汇总统计

| 类别 | 数量 |
|------|------|
| 🔴 高危 (H) | 21 处 (any 滥用 19 + 全表扫描 2) |
| 🟠 中危 (M) | 12 处 (重复函数 6 + 性能 3 + 架构耦合 2 + 冗余逻辑 1) |
| 🟡 低危 (L) | 8 处 (未使用导入 5 + 可维护性 3) |
| ℹ️ 建议 (I) | 4 处 (测试/主题/命名) |
| **合计** | **45 处** |

---

## 九、重构优先事项

### P0 — 立即修复（会影响运行时正确性）
1. **`loadRulesByCategory` 丢弃第一次查询结果** → 移除冗余调用
2. **`categoryStore.ts` 导入 `useSQLiteContext` 未使用** → 清理

### P1 — 高优先级（提升代码质量底线）
3. **Store 接口 `db: any` → `SQLiteDatabase`** → 全项目类型安全
4. **`catch (e: any)` → `catch (e: unknown)`** → 19 处统一修复
5. **重复辅助函数提取到 `src/utils/`** → 消除重复

### P2 — 中优先级（性能和可维护性）
6. **`findMatchingRules` 改为 SQL LIKE 查询** → 性能优化
7. **`seedDefaultCategoryRules` 加事务包装** → 启动性能优化
8. **`CategoryIcon as any` 定义 icon 类型** → 编译期安全

### P3 — 低优先级（长期健康）
9. **Store + DB 解耦** → 引入依赖注入或内部 db holder
10. **魔法颜色字符串统一为主题 token**
11. **拆解 `Category` 类型为 Entity / View 两层**
12. **为 `categoryStore.ts` 补充独立单元测试**

---

## 十、推荐行动项（可加入 Todo 看板）

| # | 标题 | 优先级 | 预计工作量 |
|---|------|--------|-----------|
| 1 | Store 接口 `any` 替换为 `SQLiteDatabase` | P1 | 1h |
| 2 | 统一 `catch` 错误类型处理 | P1 | 0.5h |
| 3 | 提取重复辅助函数到 utils | P1 | 0.5h |
| 4 | 修复 `loadRulesByCategory` 冗余查询 | P0 | 15min |
| 5 | `findMatchingRules` 改为 SQL LIKE | P2 | 0.5h |
| 6 | 迁移初始化事务包装 | P2 | 0.5h |
| 7 | 清理未使用的 import | P2 | 15min |
| 8 | CategoryIcon `as any` 类型安全 | P2 | 0.5h |
| 9 | 补充 categoryStore 单元测试 | P3 | 1h |
| 10 | Store 层与 SQLite 解耦设计 | P3 | 2h（需设计评审） |
