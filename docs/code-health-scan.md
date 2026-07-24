# 代码健康扫描报告

> **项目**: finance-tracker (Expo / React Native + TypeScript + Zustand)  
> **文件数**: 30 个源文件 + 14 个测试文件  
> **总代码量**: ~8,015 行  
> **扫描日期**: 2026-07-24  
> **扫描方式**:  
> - ESLint v9.39.5 静态分析（71 条 warnings，0 error）  
> - TypeScript `tsc --noEmit`（0 error）  
> - 手动代码审查

---

## 严重程度定义

| 等级 | 标识 | 说明 |
|------|------|------|
| 🔴 **高危** | H | 可能引发运行时错误或数据不一致，建议 1~2 周内修复 |
| 🟠 **中危** | M | 导致维护困难、重复劳动、容易引入缺陷，建议 1 月内规划修复 |
| 🟡 **低危** | L | 风格 / 约定 / 可读性问题，长期积累会恶化 |
| ℹ️ **改进建议** | I | 架构级建议，非坏味道 |

---

## 一、类型安全 — `any` 滥用 (H)

> **ESLint 检出: 28 处 `@typescript-eslint/no-explicit-any` warnings**

### 1.1 Store 接口中 `db` 参数全为 `any`

所有 4 个 Zustand store 的接口定义均未使用 `SQLiteDatabase` 类型，丢失了所有类型信息：

**`src/stores/transactionStore.ts`** (4 处)
```
Line 29: loadMonthlyData: (db: any, month: string) => Promise<void>;
Line 30: addTransaction: (db: any, ...) => Promise<Transaction | null>;
Line 31: editTransaction: (db: any, ...) => Promise<boolean>;
Line 32: removeTransaction: (db: any, ...) => Promise<boolean>;
```

**`src/stores/budgetStore.ts`** (4 处 — 第 26-29 行)
**`src/stores/categoryRuleStore.ts`** (5 处 — 第 17-21 行)
**`src/stores/categoryStore.ts`** (7 处 — 第 22-28 行)

> **建议修复**: 统一替换为 `import { SQLiteDatabase } from 'expo-sqlite'`。

### 1.2 `catch` 分支全部使用 `e: any`

共 19 处 `catch (e: any)`，其中 pattern 完全一致：

```typescript
} catch (e: any) {
  set({ error: e.message, loading: false });
}
```

`e.message` 并非标准属性（`Error` 接口有，但 `any` 完全跳过检查）。

**分布**:
- `src/stores/transactionStore.ts` — 4 处 (69, 103, 126, 149)
- `src/stores/budgetStore.ts` — 4 处 (62, 116, 161, 181)
- `src/stores/categoryRuleStore.ts` — 5 处 (36, 50, 76, 114, 128)
- `src/stores/categoryStore.ts` — 6 处 (46, 56, 81, 116, 146, 166)

> **建议修复**: `catch (e: unknown)` + `(e instanceof Error ? e.message : 'Unknown error')`

### 1.3 `as any` 跳过类型检查 (3 处)

| 位置 | 代码 |
|------|------|
| `src/components/CategoryIcon.tsx:18` | `<MaterialCommunityIcons name={iconName as any} ...>` |
| `src/components/CategoryManager.tsx:370` | `<MaterialCommunityIcons name={icon as any} ...>` |
| `src/components/CategoryManager.tsx:434` | `<MaterialCommunityIcons name={icon as any} ...>` |

`@expo/vector-icons` 的 `name` prop 要求字面量联合类型。`as any` 使拼写错误只能在运行时暴露。

---

## 二、未使用的变量和导入 (L)

> **ESLint 检出: 19 处 `@typescript-eslint/no-unused-vars` warnings**

### 2.1 未使用的导入

| 文件 | 未使用的导入 |
|------|-------------|
| `src/components/CategorySelector.tsx` | `FlatList`, `Chip`, `Divider`, `TextInput` |
| `src/components/CategoryManager.tsx` | `useCallback`, `FlatList`, `Divider`, `CategoryRule` |
| `src/components/CategoryIcon.tsx` | `IconButton` |
| `src/components/BudgetProgressCard.tsx` | `TouchableOpacity` |
| `app/(tabs)/index.tsx` | `Alert` |
| `app/(tabs)/budget.tsx` | `Alert` |

### 2.2 未使用的变量

| 位置 | 未使用的变量 |
|------|-------------|
| `src/stores/transactionStore.ts:8` | 导入的 `TransactionType` |
| `src/stores/categoryStore.ts:2` | 导入的 `useSQLiteContext` |
| `src/database/migrations.ts:36` | 常量 `CURRENT_DB_VERSION` |

### 2.3 Store 解构但未使用的变量

**`src/components/CategoryManager.tsx`** 从 store 解构了大量未使用的字段：

```typescript
const {
  // ...
  removeCategory,       // 仅 .then 链式调用中间接使用了 getState().removeCategory
  forceRemoveCategory,  // ✅ 实际使用
  categoryError,        // ❌ 未使用 — 第 59 行
  clearCategoryError,   // ❌ 第 60 行
  // ...
  rules,                // ❌ 第 64 行
  editRule,             // ❌ 第 67 行
  ruleError,            // ❌ 第 70 行
  clearRuleError,       // ❌ 第 71 行
} = useCategoryStore();
```

`loadRulesByCategory` 的 ESLint 检出中 `rules` 被赋值但未使用 (Line 44)。

---

## 三、代码重复 (M)

### 3.1 辅助函数重复定义

以下函数在多个文件中以完全相同的逻辑重复定义：

| 函数 | 出现次数 | 位置 |
|------|---------|------|
| `getCurrentMonth()` | 4 次 | `app/(tabs)/index.tsx:42`, `app/(tabs)/budget.tsx:25`, `src/stores/transactionStore.ts:38`, `src/stores/budgetStore.ts:35` |
| `getPrevMonth()` | 3 次 | `app/(tabs)/index.tsx:26`, `app/(tabs)/budget.tsx:32`, `src/database/budgetRepository.ts:14` |
| `getNextMonth()` | 2 次 | `app/(tabs)/index.tsx:34`, `app/(tabs)/budget.tsx:40` |
| `formatMonthLabel()` | 2 次 | `src/components/MonthSelector.tsx:12`, `app/(tabs)/index.tsx:21` |
| `formatAmount()` | 2 次 | `src/components/BudgetProgressCard.tsx:16`, `app/(tabs)/index.tsx:17` |
| `isValidDate()` | 1 次 | `src/components/TransactionForm.tsx:23` |
| `getTodayString()` | 1 次 | `src/components/TransactionForm.tsx:15` |

> **建议修复**: 提取到 `src/utils/date.ts` 和 `src/utils/format.ts`。

### 3.2 Query + reload pattern 模板化 (Store 中的 Promise.all 重复模式)

每个 store 中 `add` / `edit` / `remove` / `load` 方法都包含几乎相同的 "执行操作 → reload" 三连模式。以 `transactionStore.ts` 为例：

```typescript
// 在 add (L83-93), edit (L115-123), remove (L138-146), load (L57-66) 中重复
const [transactions, monthlyTotals, categoryExpenses] = await Promise.all([
  getTransactionsByMonth(db, currentMonth),
  getMonthlyTotals(db, currentMonth),
  getMonthlyExpenseByCategory(db, currentMonth),
]);
set({ transactions, monthlyTotals, categoryExpenses });
```

同样的 `Promise.all([...]).then(set(...))` 模式在 `budgetStore.ts` 中重复了 4 次 (L52, L108, L153, L174)。

---

## 四、性能问题 (M)

### 4.1 `findMatchingRules` 内存全表扫描

**`src/database/categoryRuleRepository.ts:90-98`**

```typescript
// 注释声称 "SQLite LIKE doesn't support CJK well"
// 但 SQLite 的 LIKE 对 CJK 完全正常
const rules = await db.getAllAsync<...>(`
  SELECT cr.*, c.name as category_name, ...
  FROM category_rules cr
  JOIN categories c ON cr.category_id = c.id
  ORDER BY cr.priority DESC
`);
return rules.filter(rule => note.includes(rule.keyword));  // JS 内存过滤
```

每次自动分类（如用户输入描述）都将全部规则拉到 JS 内存中过滤。数据库行数增长后，此操作会成为明显瓶颈。

### 4.2 `seedDefaultCategoryRules` N+1 查询

**`src/database/migrations.ts:L103-110`**

```typescript
for (const keyword of keywords) {
  await db.runAsync('INSERT INTO category_rules ...', [category.id, keyword, 0]);
}
```

约 60 条 INSERT 逐条执行（无事务包装），每条产生一次磁盘 I/O + WAL flush。

### 4.3 迁移中 `seedDefaultCategoryRules` 的分隔查询

同一个函数中先按分类名查 `SELECT id`（9 次独立查询），再逐条 INSERT（~60 次），共约 69 次数据库往返。

---

## 五、架构耦合 (M)

### 5.1 DB 上下文直接穿透到视图层

`useSQLiteContext()` 在以下 6 个组件/屏幕中直接调用：

| 组件 | 文件 |
|------|------|
| `TransactionForm` | `src/components/TransactionForm.tsx:36` |
| `CategorySelector` | `src/components/CategorySelector.tsx:18` |
| `CategoryManager` | `src/components/CategoryManager.tsx:50` |
| `HomeScreen` | `app/(tabs)/index.tsx:50` |
| `BudgetScreen` | `app/(tabs)/budget.tsx:49` |

每个 store 的方法签名本身就是以 `(db: SQLiteDatabase, ...)` 开头的，这意味着 store 没有被设计为"管理层"，而更像是"接收 db 参数的纯数据操作函数集合"。

> **长期建议**: 将 db 实例注入到 store 内部（如通过 Provider + context 或 store 的 init 方法），使组件层不再感知 DB 细节。

---

## 六、逻辑可疑 / 潜在 Bug (H)

### 6.1 `loadRulesByCategory` 丢弃第一次查询结果

**`src/stores/categoryRuleStore.ts:44-52`**

```typescript
loadRulesByCategory: async (db, categoryId) => {
    set({ loading: true, error: null });
    try {
      const rules = await getRulesByCategoryId(db, categoryId);  // ← 查询结果被丢弃
      set({ loading: false });  // ← 这里没有存储 rules
      const allRules = await getAllRules(db);  // ← 又全量查询
      set({ rules: allRules, loading: false });  // ← 第一次结果已丢失
    }
```

第一次 `getRulesByCategoryId` 返回的结果未被任何地方使用，这是重构残留或逻辑错误。

---

## 七、代码可维护性 (L)

### 7.1 `autoCategorize.ts` 中 Category 字段虚假填充

**`src/utils/autoCategorize.ts:38-44`**

```typescript
category: {
    id: bestMatch.category_id,
    name: bestMatch.category_name,
    icon: bestMatch.category_icon,
    color: bestMatch.category_color,
    type: bestMatch.category_type as 'income' | 'expense',
    is_default: 0,         // 硬编码 — 无意义
    created_at: '',        // 空字符串 — 无意义
}
```

`Category` 接口包含了数据库实体字段，而此处只需要只读视图字段。应拆分为 `CategoryView` 与 `CategoryEntity`。

### 7.2 TransactionForm 的 typeRef 模式

**`src/components/TransactionForm.tsx:45-60`**

```typescript
const typeRef = useRef<TransactionType>('expense');
useEffect(() => { typeRef.current = type; }, [type]);
```

因 300ms debounce 中的闭包陈旧问题而引入 ref。可通过 `useCallback` + 最新依赖传递替代。

### 7.3 魔法颜色字符串

多处硬编码主题色 `#6200ee`:

- `src/components/CategorySelector.tsx:138` — `borderColor: '#6200ee'`
- `src/components/CategorySelector.tsx:139` — `backgroundColor: '#6200ee10'`
- `src/components/BudgetSettingDialog.tsx:224` — `borderColor: '#6200ee'`
- `src/components/BudgetSettingDialog.tsx:225` — `backgroundColor: '#6200ee15'`

应使用 `react-native-paper` 的 `useTheme()` 动态获取主题色。

### 7.4 `CategoryManager.tsx` 文件过大

`CategoryManager.tsx` 是项目中**最大的单文件**（663 行），包含：
- 5 个 Dialog（添加、编辑、关键词管理 × 状态）
- 分类 CRUD 逻辑
- 关键词 CRUD 逻辑
- 图标/颜色选择器网格
- 内联 JSX icon grids

建议拆分:
- `CategoryManager.tsx` — 主列表 + FAB
- `CategoryFormDialog.tsx` — 添加/编辑对话框
- `CategoryKeywordDialog.tsx` — 关键词管理对话框

### 7.5 `CURRENT_DB_VERSION` 已定义但未引用

**`src/database/migrations.ts:36`**

```typescript
const CURRENT_DB_VERSION = 3;  // ESLint 检出未使用
```

版本号是在各个 `migrateV1/V2/V3` 函数中用 `PRAGMA user_version = X` 硬编码的。提取此常量但未被使用。

---

## 八、非空断言 (I)

### ESLint 检出: 2 处 `@typescript-eslint/no-non-null-assertion`

| 位置 | 代码 |
|------|------|
| `src/components/CategoryManager.tsx:145` | `useCategoryStore.getState().error!` |
| `src/components/TransactionForm.tsx:137` | `category_id: selectedCategoryId!` |

`!` 会在编译后的 JS 中原样保留，运行时如果值为 `null`/`undefined`，不会产生类型错误而是静默传播 `undefined`。

---

## 九、测试文件问题 (L)

### 9.1 Mock 中同样使用 `any`

测试文件遵循与源码相同的模式：

```typescript
// __tests__/transaction/transactionStore.test.ts
jest.fn(async (db: any, input: TransactionCreateInput) => { ... })

// __tests__/transaction/transactionRepository.test.ts
let db: any;
```

### 9.2 `categoryStore` 缺少独立单元测试

所有其他 3 个 store 都有独立的单元测试文件，唯独 `categoryStore.ts` 的 store 逻辑（状态管理、排序、过滤）没有直接覆盖，仅通过集成测试（`HomeScreen`、`TransactionForm`）间接覆盖。

---

## 十、汇总统计

### ESLint 静态分析结果

| 规则 | Warnings 数 | 占比 |
|------|-------------|------|
| `@typescript-eslint/no-explicit-any` | 28 | 39.4% |
| `@typescript-eslint/no-unused-vars` | 19 | 26.8% |
| `@typescript-eslint/no-non-null-assertion` | 2 | 2.8% |
| `@typescript-eslint/prefer-optional-chain` | 1 | 1.4% |
| **总计** | **71** | 100% |

> TypeScript `tsc --noEmit` 0 error（项目编译完全通过）。

### 手动审查代码坏味道汇总

| 类别 | 高危 H | 中危 M | 低危 L | 建议 I | 合计 |
|------|--------|--------|--------|--------|------|
| 类型安全 `any` 滥用 | 28 | — | — | — | **28** |
| 未使用变量/导入 | — | — | 19 | — | **19** |
| 代码重复 | — | 12 | — | — | **12** |
| 性能问题 | — | 3 | — | — | **3** |
| 架构耦合 | — | 1 | — | — | **1** |
| 可疑逻辑/潜在 Bug | 1 | — | — | — | **1** |
| 可维护性 | — | — | 5 | 2 | **7** |
| **合计** | **29** | **16** | **24** | **2** | **71** |

---

## 十一、重构优先事项

### P0 — 立即修复（影响运行时正确性）

| # | 问题 | 文件 | 预计耗时 |
|---|------|------|---------|
| 1 | `loadRulesByCategory` 丢弃首次查询结果 | `src/stores/categoryRuleStore.ts:44-52` | 15min |

### P1 — 高优先级

| # | 问题 | 范围 | 预计耗时 |
|---|------|------|---------|
| 2 | Store 接口 `db: any` → `SQLiteDatabase` | 4 文件, ~20 处 | 1h |
| 3 | `catch (e: any)` → `catch (e: unknown)` | 19 处, 全 store | 0.5h |
| 4 | 提取重复辅助函数到 `src/utils/` | 6 个函数, 4 文件 | 0.5h |
| 5 | 清理未使用的 import / 变量 | 6 文件, 19 处 | 0.5h |

### P2 — 中优先级

| # | 问题 | 范围 | 预计耗时 |
|---|------|------|---------|
| 6 | `findMatchingRules` SQL LIKE 优化 | 1 文件 | 0.5h |
| 7 | 迁移 `seedDefaultCategoryRules` 事务包装 | 1 文件 | 0.5h |
| 8 | `as any` → icon 类型安全 | 3 处 | 0.5h |
| 9 | 魔法颜色替换为主题色 token | 2 文件 | 0.5h |

### P3 — 长期改进

| # | 问题 | 预计耗时 |
|---|------|---------|
| 10 | Store 层与 SQLite 解耦（DI / Provider） | 2h（需设计评审） |
| 11 | `CategoryManager.tsx` 拆分 (663 行) | 2h |
| 12 | `Category` 类型拆分为 Entity / View | 1h |
| 13 | 补充 `categoryStore` 单元测试 | 1h |
| 14 | Query-reload 模式提取为 helper | 1h |

---

## 十二、可进入看板的行动项

| # | 标题 | 优先级 | 标签 | 预估 |
|---|------|--------|------|------|
| 1 | 修复 categoryRuleStore.loadRulesByCategory 丢弃查询结果 | P0 | `bug` | 15min |
| 2 | Store 接口 `any` 替换为 `SQLiteDatabase` | P1 | `tech-debt`, `type-safety` | 1h |
| 3 | 统一 `catch` 使用 `e: unknown` | P1 | `tech-debt`, `type-safety` | 0.5h |
| 4 | 提取重复日期/金额格式化函数到 utils | P1 | `tech-debt`, `dry` | 0.5h |
| 5 | 清理全项目未使用的 imports/variables | P1 | `tech-debt`, `cleanup` | 0.5h |
| 6 | findMatchingRules 改为 SQL LIKE 查询 | P2 | `performance` | 0.5h |
| 7 | 迁移 seedDefaultCategoryRules 加事务 | P2 | `performance` | 0.5h |
| 8 | Icon 类型安全 — 移除 `as any` | P2 | `type-safety` | 0.5h |
| 9 | 魔法颜色替换为 useTheme 动态主题色 | P2 | `maintainability` | 0.5h |
| 10 | CategoryManager 组件拆分 | P3 | `refactor` | 2h |
| 11 | Category 类型拆分为 Entity / View 两层 | P3 | `type-safety` | 1h |
| 12 | 补充 categoryStore 单元测试 | P3 | `testing` | 1h |
| 13 | Store 层与 SQLite 解耦 | P3 | `architecture` | 2h |
