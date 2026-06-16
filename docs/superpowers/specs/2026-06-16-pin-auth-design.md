# PIN 码认证功能设计文档

**日期：** 2026-06-16
**状态：** 已批准

---

## 概述

为 finance-tracker App 新增本地 PIN 码保护功能，防止他人打开 App 查看账单数据。数据仍存储于设备本地，不涉及云同步或多账户。

---

## 架构

### 方案

采用 **Zustand store + expo-secure-store**，与现有架构完全一致。锁屏作为 overlay 渲染在 `app/_layout.tsx` 层，无需独立路由。

### 存储层

| 数据 | 存储位置 | Key |
|------|----------|-----|
| PIN 哈希（SHA-256） | expo-secure-store | `pin_hash` |
| 连续失败次数 | expo-secure-store | `pin_fail_count` |
| 锁定截止时间戳 | expo-secure-store | `pin_lock_until` |
| 后台离开时间 | zustand 内存（useRef） | — |

### 认证状态（useAuthStore）

```ts
interface AuthState {
  isAuthenticated: boolean
  isPinSet: boolean
  isLocked: boolean       // 渐进式锁定中
  lockUntil: number | null
  failCount: number
}
```

### 渲染逻辑（app/_layout.tsx）

```
isPinSet && !isAuthenticated  →  <LockScreen />
isPinSet && isAuthenticated   →  <Slot />
!isPinSet                     →  <Slot />
```

### AppState 监听

- `background → active`：检查离开时长，超过 **5 分钟**则将 `isAuthenticated` 置为 `false`
- 离开时间记录在 `useRef` 中，不持久化

---

## 组件与文件结构

### 新增文件

```
src/
  stores/
    authStore.ts          # zustand auth store（verify、setup、reset 逻辑）
  utils/
    pinHash.ts            # SHA-256 哈希工具函数
  components/
    PinPad.tsx            # 数字键盘（纯展示，可复用）
    LockScreen.tsx        # 解锁界面
    PinSetup.tsx          # 设置 / 修改 PIN 界面（两步确认）

app/
  (tabs)/
    settings.tsx          # 新增「设置 PIN」入口（修改现有文件）
```

### 组件职责

**PinPad**
- 纯展示组件，渲染 0-9 数字键 + 退格键
- Props: `onDigit(digit: string)`, `onDelete()`, `disabled?: boolean`
- 显示 6 个圆点指示输入进度

**LockScreen**
- 使用 `PinPad`，调用 `useAuthStore.verify(pin)` 校验
- 展示错误提示（"PIN 码错误，还剩 N 次"）
- 锁定期间显示倒计时（"请等待 XX 秒后重试"）

**PinSetup**
- 两步确认流程：输入新 PIN → 再次确认
- 作为 settings 页面的 formSheet modal 展示
- 支持设置新 PIN 和修改现有 PIN

---

## 渐进式锁定规则

| 连续失败次数 | 锁定时长 |
|---|---|
| 5 次 | 30 秒 |
| 8 次 | 2 分钟 |
| 10 次及以上 | 5 分钟 |

锁定时间戳持久化到 `expo-secure-store`，App 重启后继续生效。

---

## 错误处理

- `expo-secure-store` 读写失败：catch 后 UI 提示错误，不崩溃
- 哈希计算失败：降级提示用户重试
- 锁定期间强制重启 App：重新从 `expo-secure-store` 读取 `pin_lock_until`，继续显示倒计时

---

## 测试计划

| 测试目标 | 类型 | 覆盖点 |
|---|---|---|
| `pinHash.ts` | 单元测试 | 相同输入 → 相同哈希；不同输入 → 不同哈希 |
| `authStore.ts` | 单元测试 | verify 逻辑、渐进式锁定计数、后台超时判断 |
| `LockScreen` | 集成测试（RNTL） | 输入流程、错误状态、锁定倒计时展示 |
| `PinSetup` | 集成测试（RNTL） | 两步确认流程、不一致时的错误提示 |

---

## 范围外（本次不实现）

- 生物识别（Face ID / Touch ID）
- 云端 PIN 同步
- 多用户支持
- 截图保护
