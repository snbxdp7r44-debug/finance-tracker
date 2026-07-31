# 代码健康扫描报告

> **项目**: finance-tracker (Expo / React Native + TypeScript + Zustand + SQLite)
> **扫描日期**: 2026-07-27
> **基线（可复现）**:
> - `npx tsc --noEmit` — 0 error ✅
> - `npx jest --forceExit` — 178/180 通过，**2 失败** ❌
> - ESLint（临时 flat config）— **164 warnings**（仓库内无 eslint 配置文件，`npx eslint .` 无法直接运行，详见 §9.1）
>
> **⚠️ 本报告重写了上一版（2026-07-24）报告**：上一版的部分结论已过期（见 §10），且其引用的 ESLint 结果（71 warnings）因缺少配置文件而**不可复现**，统计口径（28+19+2+1≠71）也不一致。

---

## 严重程度定义

| 等级 | 标识 | 说明 |
|------|------|------|
| 🔴 **高危** | H | 可能引发运行时错误 / 数据不一致 / CI 失败，建议 1~2 周内修复 |
| 🟠 **中危** | M | 导致维护困难、重复劳动、容易引入缺陷，建议 1 月内规划修复 |
| 🟡 **低危** | L | 风格 / 约定 / 可读性问题，长期积累会恶化 |
| ℹ️ **改进建议** | I | 架构级建议，非坏味道 |

---

## 一、测试失败（H）— CI 当前是红的

### 1.1 `__tests__/categoryRule/categoryRuleStore.test.ts:83-91` — 测试与实现脱节

```
FAIL  categoryRuleStore › loadRulesByCategory › should handle errors gracefully
Expected: "DB error"
Received: null
```

该测试 mock 了 `getRulesByCategoryId` 抛错，但当前实现（`src/stores/categoryRuleStore.ts:44-53`）在上一轮修复后已**不再调用** `getRulesByCategoryId`（只调用 `getAllRules`），因此错误未被捕获。**测试断言的是已废弃的错误行为**，与实现不一致。

### 1.2 `__tests__/screens/SettingsScreen.test.tsx` — 测试缺少必要 mock

渲染 `SettingsScreen` 时 `react-native-paper` 的 `List.Icon` 报 "none of the required icon libraries are installed"。该测试文件**没有 mock `@expo/vector-icons` 与 `expo-router`**（其他屏幕测试均有，如 `HomeScreen.test.tsx:2-27`），属测试基础设施缺失而非产品 bug。

---

## 二、类型安全 — `any` 滥用（H，110 处）

### 2.1 Store 接口与实现的 `db: any` — 40 处（src 43 处 any 中的主体）

所有 4 个 Zustand store 均未使用 `SQLiteDatabase` 类型，丢失全部类型信息：

| 文件 | 接口定义（行） | 实现 catch/参数（行） | 小计 |
|------|--------------|---------------------|------|
| `src/stores/categoryStore.ts` | 22-28（7 处） | 46, 56, 81, 116, 146, 152, 166 | 14 |
| `src/stores/categoryRuleStore.ts` | 16-20（5 处） | 35, 45, 71, 109, 123 | 10 |
| `src/stores/budgetStore.ts` | 26-29（4 处） | 62, 116, 161, 181 | 8 |
| `src/stores/transactionStore.ts` | 29-32（4 处） | 69, 103, 126, 149 | 8 |

> **建议**: 接口统一 `import { SQLiteDatabase } from 'expo-sqlite'`；catch 统一 `(e: unknown)` + `e instanceof Error ? e.message : '未知错误'`。

### 2.2 `as any` 跳过 icon 类型检查 — 3 处

| 位置 | 代码 |
|------|------|
| `src/components/CategoryIcon.tsx:18` | `<MaterialCommunityIcons name={iconName as any} ...>` |
| `src/components/CategoryManager.tsx:370` | `<MaterialCommunityIcons name={icon as any} ...>`（添加对话框图标网格） |
| `src/components/CategoryManager.tsx:434` | 同上（编辑对话框图标网格） |

icon 名拼写错误只能在运行时暴露。

### 2.3 非空断言 `!` — src 2 处

| 位置 | 代码 | 风险 |
|------|------|------|
| `src/components/CategoryManager.tsx:145` | `useCategoryStore.getState().error!` | 运行时为 null 时静默传播 undefined |
| `src/components/TransactionForm.tsx:137` | `category_id: selectedCategoryId!` | 前置校验保证非空，可改为提前 return |

### 2.4 测试文件 `any` — 67 处

```typescript
// 典型：__tests__/budget/budgetRepository.test.ts:14、__tests__/transaction/transactionStore.test.ts:6 ...
jest.fn(async (db: any, input: TransactionCreateInput) => { ... })
let db: any;
```

测试 mock 大面积 `any`，mock 与真实签名脱节的风险被放大。

---

## 三、未使用的导入 / 变量 / 死代码（L，src 25 处）

### 3.1 未使用的导入

| 文件 | 未使用的导入 |
|------|-------------|
| `app/(tabs)/index.tsx:8` | `Alert` |
| `app/(tabs)/budget.tsx:7` | `Alert` |
| `src/components/BudgetProgressCard.tsx:2` | `TouchableOpacity` |
| `src/components/CategoryIcon.tsx:3` | `IconButton` |
| `src/components/CategoryManager.tsx:1,5,23,28` | `useCallback`、`FlatList`、`Divider`、`CategoryRule` |
| `src/components/CategorySelector.tsx:2,4` | `FlatList`、`Chip`、`Divider`、`TextInput` |
| `src/stores/categoryStore.ts:2` | `useSQLiteContext`（store 内不需要它） |
| `src/stores/transactionStore.ts:8` | `TransactionType` |
| `src/database/migrations.ts:36` | `CURRENT_DB_VERSION`（版本号在 PRAGMA 中硬编码） |

### 3.2 解构但未使用的变量

**`src/components/CategoryManager.tsx:55-71`** — 从两个 store 解构了大量字段但从不使用：

```typescript
const { removeCategory, forceRemoveCategory, categoryError, clearCategoryError, ... } = useCategoryStore();
// categoryError / clearCategoryError / rules / editRule / ruleError / clearRuleError 均未使用（8 个）
```

`removeCategory` / `forceRemoveCategory` 实际通过 `useCategoryStore.getState().xxx` 调用，解构变量是误导。

### 3.3 死代码

- **`src/components/CategorySelector.tsx:33-54`** — `renderCategoryItem` 完整实现但从未被引用；`renderSection`（L56-83）重复实现了相同逻辑。
- **`src/components/TransactionForm.tsx:121-123`** — `handleCategorySelect` 空回调（仅 `setCategoryError('')`），命名为 "Select" 却不接收 `category` 参数，用作 `onSelect` 时参数被 JS 静默丢弃。

---

## 四、代码重复（M）

### 4.1 辅助函数重复定义

| 函数 | 次数 | 位置 |
|------|------|------|
| `getCurrentMonth()` | **5** | `app/(tabs)/index.tsx:42`、`app/(tabs)/budget.tsx:25`、`app/(tabs)/statistics.tsx:26`、`src/stores/transactionStore.ts:38`、`src/stores/budgetStore.ts:35` |
| `getPrevMonth()` | 3 | `app/(tabs)/index.tsx:26`、`app/(tabs)/budget.tsx:32`、`src/database/budgetRepository.ts:14` |
| `getNextMonth()` | 2 | `app/(tabs)/index.tsx:34`、`app/(tabs)/budget.tsx:40` |
| `formatMonthLabel()` | 3 | `src/components/MonthSelector.tsx:12`、`app/(tabs)/index.tsx:21`、`app/(tabs)/statistics.tsx:21` |
| `formatAmount()` | 2 | `src/components/BudgetProgressCard.tsx:16`、`app/(tabs)/index.tsx:17` |
| `getTodayString()` / `isValidDate()` | 1+1 | `src/components/TransactionForm.tsx:15,23` |

> **建议**: 提取到 `src/utils/date.ts` 与 `src/utils/format.ts`（`src/utils/index.ts` 已存在 barrel 导出）。

### 4.2 Store 中 "执行操作 → Promise.all reload" 模板重复 — 8 处

```typescript
// transactionStore.ts 的 add/edit/remove/load 与 budgetStore.ts 的 add/edit/remove/load 几乎相同
const [transactions, monthlyTotals, categoryExpenses] = await Promise.all([
  getTransactionsByMonth(db, currentMonth),
  getMonthlyTotals(db, currentMonth),
  getMonthlyExpenseByCategory(db, currentMonth),
]);
set({ transactions, monthlyTotals, categoryExpenses });
```

- `src/stores/transactionStore.ts` — 4 处（L57-66, 83-93, 115-123, 138-146）
- `src/stores/budgetStore.ts` — 4 处（L52-60, 108-116, 153-161, 174-182）

### 4.3 动态 SQL 字段构建器重复 — 4 处

`updateTransaction` / `updateBudget` / `updateCategory` / `updateRule` 均为 "fields[] + values[] + 条件拼装" 结构（`transactionRepository.ts:42-76`、`budgetRepository.ts:66-98`、`categoryRepository.ts:42-69`、`categoryRuleRepository.ts:36-56`），可提取统一 helper。

---

## 五、性能问题（M）

### 5.1 `findMatchingRules` JS 内存全表扫描 — `src/database/categoryRuleRepository.ts:90-98`

```typescript
// 注释声称 "SQLite LIKE doesn't support CJK well"（不成立，SQLite LIKE 对 CJK 正常）
const rules = await db.getAllAsync(...全表 JOIN...);
return rules.filter(rule => note.includes(rule.keyword));  // JS 内存过滤
```

每次自动分类都将全部规则拉入 JS 内存。规则表增长后成为明显瓶颈；且 `ORDER BY priority DESC` 后再 filter 也依赖 JS 端保持顺序。

> **建议**: `WHERE ? LIKE '%' || keyword || '%'` 下推到 SQL，或为 `keyword` 建索引后 SQL 过滤。

### 5.2 迁移 `seedDefaultCategoryRules` N+1 — `src/database/migrations.ts:99-119`

- 9 次 `SELECT id FROM categories WHERE name = ?`（按分类名）
- ~60 次逐条 `INSERT INTO category_rules`（无事务，每次一次磁盘 I/O + WAL flush）

合计约 69 次数据库往返，仅在首次安装时执行，但仍是明显可优化项。

### 5.3 `calculateBudgetStatus` N+1 — `src/database/budgetRepository.ts:139-171`（上一版报告遗漏）

```typescript
const statuses = await Promise.all(
  budgets.map(async (budget) => {
    const rolloverFromPrevious = await computeRollover(db, month, ...); // 内部再查 1~2 次
    ...
  })
);
```

每个预算触发 `computeRollover` → `getBudgetForMonthCategory`（上月预算）+ 可选月度汇总，**N 个预算 = 2N+2 次查询**，且与外部已查的 `categoryExpenses/monthlyTotals` 重复。

---

## 六、架构耦合（M）

### 6.1 DB 上下文穿透视图层 — 6 处

`useSQLiteContext()` 直接在视图组件/屏幕中调用：`TransactionForm.tsx:36`、`CategorySelector.tsx:18`、`CategoryManager.tsx:50`、`index.tsx:50`、`budget.tsx:49`、`statistics.tsx:31`。Store 方法签名以 `(db, ...)` 开头，本质是"接收 db 的数据操作函数集合"而非管理层。

### 6.2 `loadRulesByCategory(db, categoryId)` 忽略 `categoryId` — `src/stores/categoryRuleStore.ts:44`

上一轮修复后参数被重命名为 `_categoryId` 但语义未对齐：方法名/签名承诺"按分类加载"，实现却是全量 `getAllRules`。调用方（CategoryManager）实际也只需要全量，**建议改名为 `loadRules` 或实现真正的按分类过滤**。

### 6.3 预算页隐式调用交易 store — `app/(tabs)/budget.tsx:63`

```typescript
const { loadMonthlyData } = useTransactionStore();  // 仅为了副作用
...
loadMonthlyData(db, currentMonth);  // 返回数据未使用
```

预算页不展示交易数据，此调用仅为同步 `transactionStore.currentMonth`，属隐式跨页面耦合，可能造成意外的状态联动。

---

## 七、逻辑可疑 / 虚假数据（M/L）

### 7.1 `autoCategorize.ts` 虚假填充实体字段 — `src/utils/autoCategorize.ts:38-44`

```typescript
category: {
  id: bestMatch.category_id, name: ..., icon: ..., color: ..., type: ...,
  is_default: 0,   // 硬编码，无意义
  created_at: '',  // 空字符串，无意义
}
```

`Category` 接口混入数据库实体字段，而此处只需视图字段。建议拆分 `CategoryView`（id/name/icon/color/type）与 `CategoryEntity`（+is_default/created_at）。

### 7.2 `TransactionForm` 的 typeRef 模式 — `src/components/TransactionForm.tsx:45-60`

为规避 300ms debounce 内陈旧闭包引入 `typeRef` + 同步 effect。可通过 `useEffect` 依赖 `type` 或 `useCallback` 重构简化。

### 7.3 `settings.tsx` 深色模式 Switch 为禁用死 UI

```typescript
<Switch value={isDark} disabled />  // 展示但不可操作
```

外观设置页存在一个不可交互的开关（`_layout.tsx` 实际已按系统深浅色渲染主题）。

---

## 八、可维护性（L）

### 8.1 魔法颜色 `#6200ee` 硬编码 — 5 处

`CategorySelector.tsx:138-139`（border/background）、`BudgetSettingDialog.tsx:224-225`、`CategoryManager.tsx:368,378`（iconPickerItemSelected）。应使用 `react-native-paper` 的 `useTheme()`。

### 8.2 `CategoryManager.tsx` 单文件 663 行

包含 5 个 Dialog、分类 CRUD、关键词 CRUD、图标/颜色选择器。建议拆分：`CategoryManager`（列表+FAB）、`CategoryFormDialog`、`CategoryKeywordDialog`。

### 8.3 `CURRENT_DB_VERSION = 3` 定义未使用；版本号硬编码在 `PRAGMA user_version = N`（migrations.ts 各 migrate 函数末尾）

### 8.4 `statistics.tsx:11` 模块级 `screenWidth = Dimensions.get('window').width` — 非响应式，横屏/分屏不更新

---

## 九、工程化问题（L/H 影响）

### 9.1 ⚠️ 仓库缺少 ESLint 配置文件（影响面大）

`package.json` 声明了 `eslint` + `@typescript-eslint/*` + `eslint-plugin-react`，但仓库**没有 `eslint.config.js` / `.eslintrc.*`**：

```
$ npx eslint .
→ Error: ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

后果：
- 上一版报告的 ESLint 结果（71 warnings）不可复现，需临时配置才能复现；
- CI 无法以统一规则把关，`any` 等坏味道会继续堆积。

本报告的 164 项结果基于临时 flat config（仅启用 3 条规则：`no-explicit-any` / `no-unused-vars` / `no-non-null-assertion`），未启用项目中已声明的 `eslint-plugin-react` 规则。

### 9.2 测试文件坏味道 — 94 处问题（any 67 / unused 19 / nonnull 8）

- `__tests__/App.test.tsx:2` — `Text`/`View` 导入未使用
- `__tests__/category/categoryRepository.test.ts` — 4 个导入的 repository 函数未使用（测试覆盖不足的信号）
- 各 store/repository 测试中 `db: any` 的 mock 实例

---

## 十、上一版报告结论核对（2026-07-24 → 现状）

| 上一版结论 | 现状 |
|-----------|------|
| P0：`loadRulesByCategory` 丢弃首次查询结果（bug） | ✅ 已修复（§6.2 残留 API 语义问题） |
| `catch (e: any)` 19 处 | ⚠️ 仍存在（数量一致） |
| Store 接口 `db: any` ~20 处 | ⚠️ 仍存在（含实现共 40 处） |
| `as any` icon 3 处 | ⚠️ 仍存在 |
| 未使用导入/变量 19 处（src） | ⚠️ 仍存在（src 25 处） |
| `findMatchingRules` / `seedDefaultCategoryRules` N+1 | ⚠️ 仍存在 |
| `calculateBudgetStatus` N+1 | ❌ 上一版遗漏，本次新发现（§5.3） |
| `CategorySelector.renderCategoryItem` 死代码 | ❌ 上一版遗漏，本次新发现（§3.3） |
| `settings.tsx` 禁用 Switch | ❌ 上一版遗漏，本次新发现（§7.3） |
| ESLint 71 warnings | ❌ 不可复现；且项目无 eslint 配置（§9.1） |
| 测试目录 | ❌ 上一版完全未统计（实际 94 处问题 + 2 个失败测试） |

---

## 十一、汇总统计

### ESLint 静态分析（临时 flat config，3 条规则）

| 规则 | src+app | __tests__ | 合计 |
|------|---------|-----------|------|
| `@typescript-eslint/no-explicit-any` | 43 | 67 | **110** |
| `@typescript-eslint/no-unused-vars` | 25 | 19 | **44** |
| `@typescript-eslint/no-non-null-assertion` | 2 | 8 | **10** |
| **合计** | **70** | **94** | **164** |

> TypeScript `tsc --noEmit` 0 error；Jest 178/180（2 失败，见 §1）。

### 坏味道分类汇总

| 类别 | H | M | L | I | 说明 |
|------|---|---|---|---|------|
| 测试失败 | 2 | — | — | — | CI 红 |
| `any` 滥用 | 40 | — | 70 | — | src 40 + 测试 67 + icon 3 |
| 未使用代码 | — | — | 25 | — | 含死代码 2 处 |
| 代码重复 | — | 15 | — | — | 函数 ×13 + reload 模式 ×8 + SQL 构建 ×4 |
| 性能 | — | 3 | — | — | 内存过滤 + 两处 N+1 |
| 架构耦合 | — | 3 | — | — | DB 穿透、API 语义、跨 store 副作用 |
| 可维护性 | — | 2 | 4 | — | 大文件、魔法颜色、假数据、typeRef |
| 工程化 | — | — | 1 | 3 | eslint 配置缺失等 |
| **合计** | **42** | **23** | **100** | **3** | — |

---

## 十二、重构优先事项

### P0 — 立即修复（CI 恢复）

| # | 问题 | 位置 | 预估 |
|---|------|------|------|
| 1 | categoryRuleStore 测试断言旧行为，需对齐当前实现 | `__tests__/categoryRule/categoryRuleStore.test.ts:83-91` | 15min |
| 2 | SettingsScreen 测试补齐 vector-icons / expo-router mock | `__tests__/screens/SettingsScreen.test.tsx` | 15min |

### P1 — 高优先级

| # | 问题 | 范围 | 预估 |
|---|------|------|------|
| 3 | Store `db: any` → `SQLiteDatabase`；`catch (e: any)` → `unknown` | 4 文件，40 处 | 1h |
| 4 | 补充 eslint.config.js（启用已声明的插件规则） | 仓库根 | 0.5h |
| 5 | 清理 src 未使用导入/变量/死代码 | 8 文件，25 处 | 0.5h |
| 6 | 提取重复日期/月份/金额函数到 `src/utils/` | 6 个函数，5 文件 | 0.5h |
| 7 | `findMatchingRules` 下推 SQL LIKE | 1 文件 | 0.5h |

### P2 — 中优先级

| # | 问题 | 范围 | 预估 |
|---|------|------|------|
| 8 | `calculateBudgetStatus` N+1 优化（复用已查数据） | 1 文件 | 1h |
| 9 | `seedDefaultCategoryRules` 事务包装 | 1 文件 | 0.5h |
| 10 | `loadRulesByCategory` API 语义修正（改名或真正过滤） | 1 文件 + 调用方 | 0.5h |
| 11 | icon `as any` → 类型安全（3 处）；魔法颜色 → `useTheme()` | 3 文件 | 0.5h |
| 12 | 清理测试文件 `any`（67 处）与未使用 mock | __tests__ | 1h |

### P3 — 长期改进

| # | 问题 | 预估 |
|---|------|------|
| 13 | Store 层与 SQLite 解耦（db 注入 / init 方法） | 2h（需设计评审） |
| 14 | `CategoryManager.tsx` 拆分（663 行） | 2h |
| 15 | `Category` 类型拆分 Entity / View（消除假数据填充） | 1h |
| 16 | 补充 `categoryStore` 单元测试 | 1h |
| 17 | Query-reload 模式与动态 SQL 构建器提取为 helper | 1.5h |

---

## 十三、可进入看板的行动项（backlog）

| # | 标题 | 优先级 | 标签 | 预估 |
|---|------|--------|------|------|
| 1 | 修复 categoryRuleStore 过期测试，对齐当前实现 | P0 | `bug`, `testing` | 15min |
| 2 | 修复 SettingsScreen 测试缺少 vector-icons/expo-router mock | P0 | `bug`, `testing` | 15min |
| 3 | Store 接口与 catch 的 `any` 替换为 `SQLiteDatabase` / `unknown` | P1 | `tech-debt`, `type-safety` | 1h |
| 4 | 补充 eslint.config.js 并纳入 CI | P1 | `tooling`, `engineering` | 0.5h |
| 5 | 清理 src 未使用 imports/variables/死代码（25 处） | P1 | `tech-debt`, `cleanup` | 0.5h |
| 6 | 提取重复日期/月份/金额函数到 `src/utils/` | P1 | `tech-debt`, `dry` | 0.5h |
| 7 | findMatchingRules 改为 SQL LIKE 查询 | P1 | `performance` | 0.5h |
| 8 | 优化 calculateBudgetStatus N+1 查询 | P2 | `performance` | 1h |
| 9 | 迁移 seedDefaultCategoryRules 加事务批量插入 | P2 | `performance` | 0.5h |
| 10 | 修正 loadRulesByCategory 忽略 categoryId 的 API 语义 | P2 | `maintainability` | 0.5h |
| 11 | 移除 icon `as any`，魔法颜色替换为 useTheme | P2 | `type-safety`, `maintainability` | 0.5h |
| 12 | 清理测试文件 `any` 与未使用 mock | P2 | `testing`, `cleanup` | 1h |
| 13 | Store 层与 SQLite 解耦（db 注入） | P3 | `architecture` | 2h |
| 14 | CategoryManager 组件拆分（663 行） | P3 | `refactor` | 2h |
| 15 | Category 类型拆分为 Entity / View | P3 | `type-safety` | 1h |
| 16 | 补充 categoryStore 单元测试 | P3 | `testing` | 1h |

---

## 附录：复现方法

```bash
# 1. 类型检查
npx tsc --noEmit

# 2. 测试
npx jest --forceExit

# 3. ESLint（临时配置，仅 3 条规则；仓库暂无正式配置）
cat > eslint.config.tmp.js <<'EOF'
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
module.exports = [{
  files: ['**/*.{ts,tsx}'],
  ignores: ['node_modules/**', 'assets/**', '.git/**'],
  languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } } },
  plugins: { '@typescript-eslint': tseslint },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
}];
EOF
npx eslint --config eslint.config.tmp.js . --format json
rm eslint.config.tmp.js
```
