# 挑战任务「每日进度标记与展示」设计文档

> 状态：**已实现并验证，未推送**（2026-11-24）。用户选定 **B. 只高亮提示、仍手动完成**：达标时卡片显示「🎉 已达标！」，`completeChallenge()` 与发币逻辑**完全不动**。Playwright 无头 16 组检查全过、`pageErrors=[]`。
> 触发反馈：「任务挑战的每一天也得有进度标记和显示，设计一下，增加相应功能」。
> 前置基础：`challenge-in-daily-tasks-design.md`（v1 接入每日任务页）、`challenge-push-to-daily-design.md`（v2 家长推送机制）。

## 1. 背景与目标

挑战是跨天的长期目标（"连续7天完成作业""一周读完2本书"），但目前只有 `accepted` / `completed` 两个布尔状态：

- 孩子每天做了什么**没有任何记录**，看不到"今天是第几天""已经坚持几天"；
- v1 卡片上的 `.challenge-progress` 只是死面板 `showChallenges()` 里的一句「进行中...」占位文字，不是真实进度；
- 项目里只有 `user.streak`（**全应用**按任务完成算的连续打卡），与挑战无关，不能复用为挑战进度。

**目标**：给每条挑战加「按天打卡 + 进度可视化」，孩子每天能标记、能看见每天的格子与累计/连续天数；家长能查看与纠正。

## 2. 现状调研

| 项 | 现状 |
|---|---|
| 挑战数据 | `store.challenges`，字段 `{id,title,description,bonusCoins,accepted,completed,completedAt,weeklyReset,isChallenge,pushedToDaily,pushedAt}` —— **无进度/目标字段** |
| 孩子端 | `renderChallengeSection()`：只显示状态、标题、描述、奖励；按钮为「接受挑战 ▶」+「完成 ✓」 |
| 完成 | `completeChallenge()`：二次确认 → `completed/completedAt` → 发 `bonusCoins` + `grantBonusInteraction('both')` → 卡片消失 |
| 家长端 | `renderChallengeManagement()`：编辑/删除/推送/撤回；`openChallengeEditor()` 只有 名称/描述/奖励星币 三个输入 |
| 日期工具 | `task-list.js:40 dateKey(date)` 返回**本地** `YYYY-MM-DD`（已处理时区，必须复用，不能用 `toISOString()` 的 UTC 日期） |
| 既有连续打卡 | `store.checkStreak()` / `user.streak` 是**全局任务**维度，与挑战无关，本次不动 |
| 日期条 | `getDayTaskCounts()` 只统计 `tasks`；且 `renderTasksPage()` 有"非今天重置回今天"的既有问题，历史日期实际切不到 → **本次不改日期条** |

## 3. 技术方案

### 3.1 数据模型（新增 2 个字段，向下兼容）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `targetDays` | number | `7` | 目标天数（家长设置，1–30）；`0` 表示"不设目标"，只记录打卡不显示 x/N 进度条 |
| `dailyLog` | string[] | `[]` | 已打卡的**本地日期** `YYYY-MM-DD`，去重、升序，例如 `['2026-11-22','2026-11-24']` |

派生值（实时计算，**不落库**）：
- `doneDays = dailyLog.length`
- `streak`：从今天（今天已打卡）或昨天（今天未打卡）往前连续有记录的天数；断档即 0
- `reached = targetDays > 0 && doneDays >= targetDays`

`store._migrate()`：老挑战补 `targetDays: 7` / `dailyLog: []`（**不补造历史打卡记录**）；新建挑战显式写入。

### 3.2 孩子端（每日任务页挑战卡片）

卡片内新增一块「📅 进度」区域，位于描述与按钮之间：

```
┌──────────────────────────────────────┐
│ 📅 进度 3 / 7 天        🔥 连续 2 天 │
│ ██████████░░░░░░░░░░  42%        │  ← 进度条（targetDays=0 时隐藏）
│ [一][二][三][四][五][六][日]        │  ← 最近 N 天格子，横向可滚动
│  22  23  24  25  26  27  28        │
│  ✓   ✓   ·   ·   ·   ✓   ○        │  ✓已打卡 / ·未打卡 / ○今天
└──────────────────────────────────────┘
```

- **格子范围**：最近 `N = min(max(targetDays, 7), 14)` 天，以**今天为最后一格**；只显示到今天，不显示未来。
- **格子状态**：已打卡 = 绿底 ✓；未打卡 = 灰底 ·；今天未打卡 = 橙色描边 ○（提示"今天还没打卡"）。
- **「今日打卡 ✓」按钮**：
  - 今天未打卡 → 可点，点击把 `dateKey(new Date())` 追加进 `dailyLog`（去重）
  - 今天已打卡 → 按钮变灰「今日已打卡 ✓」并禁用，**不允许孩子自己取消**（避免误操作破坏连续性）
  - 每天只能记一次；跨天自动恢复可点（靠日期 key 判断，无需定时器/重置任务）
- **达标提示**：`reached` 时卡片加金色 `.reached` 样式，进度区显示「🎉 已达标！」，按第 8 节确认的口径处理完成。
- 已有「接受挑战 ▶」「完成 ✓」按钮保持不变（沿用用户 v2 选定的 B 口径）。

### 3.3 家长端（挑战库）

- `openChallengeEditor()` 增加「目标天数」数字输入（1–30，默认 7，填 0 = 不设目标），保存写入 `targetDays`。
- `renderChallengeManagement()` 每条挑战的 meta 区增加「📅 3/7 天」文字（未设目标则显示「📅 已打卡 3 天」）。
- 新增「📅 进度」按钮 → 打开**进度明细弹窗**：列出最近 14 天格子，家长可**点格子勾选/取消打卡**（用于补记忘记打卡的日子、纠正孩子误点），底部显示累计/连续天数。
  - 只改 `dailyLog`，不触发完成/发币，避免绕过奖励逻辑。
- 已完成的挑战：进度只读展示（格子不可点）。

### 3.4 完成逻辑的衔接（用户选定 B）

`completeChallenge()` **完全不动**（仍是唯一发币入口，保留二次确认）。达标时仅：
- 进度区加 `.reached` 金色样式 + 显示「🎉 已达标！点「完成 ✓」领取奖励」；
- 打卡 toast 改为「🎉 已达标！可以点「完成 ✓」领取奖励啦」；
- 「完成 ✓」按钮保持可点，达标前后行为一致。

即：进度只做**记录与展示**，不改变完成门槛、不自动发币。

### 3.5 明确不动的东西（防回退）

- 挑战**不写入 `tasks`**，不参与 `isTodayAllDone()` / 门卫解锁 / `getDayTaskCounts()` 日期圆点。
- `user.streak` 全局连续打卡逻辑**不动**（避免挑战打卡污染任务连击）。
- `pushedToDaily` 推送机制**不动**：只有已推送的挑战显示并可打卡；撤回后 `dailyLog` 保留，再次推送继续累积。
- 完成后 `completed=true` → 卡片消失，`dailyLog` 保留供家长查看；家长端已完成挑战格子只读。
- 「只在今天视图 + 全部 分类显示」条件不变。
- 死面板 `showChallenges()` 不动（无调用点）。

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/store.js` | `_migrate()` 给 challenges 补 `targetDays:7` / `dailyLog:[]`（不造历史记录） |
| `js/task-list.js` | 新增 `getChallengeStreak()`、`renderChallengeProgress(ch)`、`checkInChallengeToday(chId)`；卡片插入进度区 + 今日打卡按钮；事件绑定；达标提示 |
| `js/parent-panel.js` | 编辑弹窗加目标天数；列表显示进度文字；新增进度明细弹窗（可补记/撤销）+ 事件 |
| `css/task.css` | `.challenge-progress-box` / `.ch-day-grid` / `.ch-day` / `.btn-ch-checkin` / `.challenge-card.reached` |
| `css/parent.css` | 进度文字、进度明细弹窗格子样式 |
| `docs/challenge-daily-progress-design.md` | 本文档 |
| `monster-pet/` 子目录 | 同步上述 js / css / docs |

## 5. 实施步骤

1. 确认第 8 节口径。
2. `store.js` 迁移补字段。
3. `task-list.js`：派生计算 + 进度区渲染 + 今日打卡 + 达标提示。
4. `parent-panel.js`：目标天数输入 + 进度文字 + 明细弹窗。
5. 两处 CSS。
6. 同步 `monster-pet/`；`node --check` 全部改动 JS。
7. Playwright 无头验证（第 7 节）。
8. 发本地预览链接（说明对应版本）；**不推送**，等用户明确说"推送git"。

## 6. 防回退

- **日期必须用 `dateKey(new Date())`（本地 YYYY-MM-DD）**：项目在 GMT+8，用 `toISOString().slice(0,10)` 会在早上 8 点前算成前一天，导致"今天打卡记到昨天"。
- `dailyLog` 写入必须**去重 + 排序**，且校验格式为 `/^\d{4}-\d{2}-\d{2}$/`；家长补记时同样校验，避免脏数据让 `streak` 计算错乱。
- 迁移默认值 `dailyLog: []`，**绝不根据 `accepted`/`completed` 反推打卡记录**（老数据无从考证）。
- `checkInChallengeToday()` 必须守卫 `pushedToDaily === true && !completed`（与 `acceptChallenge`/`completeChallenge` 一致），防止直接调用给未推送挑战打卡。
- `parent-panel.js` **不要定义新的全局日期函数**（`data-io.js`/`stats-io.js` 已有同名 `getDateStr`）——进度弹窗里直接内联拼本地日期字符串，避免顶级命名冲突导致整页静默失败。
- 新增 DOM 继续用 `challenge-` / `ch-` 独立前缀，不混入 `.task-card` 事件绑定；`const` 不在同一作用域重复声明（历史踩坑：书库增删失效）。
- 家长端"补记/撤销"只改 `dailyLog`，**不得**调 `completeChallenge()` 或发币。
- 改完必须 `node --check js/task-list.js js/parent-panel.js js/store.js`；对照 `docs/monster-pet-design.md` 第十一章检查清单。

## 7. 验证方案（Playwright 无头）

1. **老数据兼容**：预置一条无新字段的旧挑战（已推送）→ 加载后 `targetDays=7, dailyLog=[]`；卡片显示「0 / 7 天」+ 7 个格子，今天未打卡。
2. **今日打卡**：点「今日打卡 ✓」→ `dailyLog` 含今天的本地日期、按钮变「今日已打卡 ✓」禁用、格子变绿、进度变「1 / 7 天」、「🔥 连续 1 天」。
3. **重复点不重复计数**：再触发一次 → `dailyLog.length` 不变。
4. **撤回再推送进度保留**：家长撤回 → 卡片消失；再推送 → 进度仍是「1 / 7 天」。
5. **连续天数**：预置昨天+前天+今天 → `streak=3`；只预置前天 → `streak=0`。
6. **家长补记/撤销**：明细弹窗点某天格子 → `dailyLog` 增减正确；已完成挑战格子只读。
7. **目标天数=0**：进度条隐藏，显示「已打卡 N 天」，不出现 `x/0`。
8. **达标**：打卡数达到 targetDays → 卡片显示「🎉 已达标！」但**不自动完成**；手动点「完成 ✓」后才发币 +20、卡片消失（沿用既有）。
9. **边界**：分类筛选隐藏、`isTodayAllDone()` 不受影响、`pageErrors=[]`；根目录与 `monster-pet/` 一致、JS 语法通过。

## 8. 已确认的口径

✅ **用户已选 B：只高亮提示、仍手动完成**（2026-11-24）。其余按默认口径：家长可设目标天数默认 7、格子显示最近 7~14 天、家长可补记/撤销打卡、完成仍是唯一发币入口、撤回后进度不清空。

原问题备查：

**累计打卡达到目标天数后，挑战怎么算完成？**

- **A. 达标即自动完成（推荐）**：最后一次打卡直接触发完成、发放星币，弹「🎉 挑战达成」。最省心，但会改变现有"手动点完成"的行为。
- **B. 只高亮提示，仍手动完成**：卡片显示「🎉 已达标！」，「完成 ✓」按钮照旧由孩子点（保留二次确认）。改动最小、完全不碰现有完成逻辑。
- **C. 达标后才能完成**：未达标时「完成 ✓」置灰不可点，达标后解锁；防止孩子提前点完成跳过打卡。

默认口径（不同意请一并说明）：进度只做**记录与展示**，不写进 `tasks`、不影响解锁；撤回后进度不清空。

回复「按 A 来」或说明调整即可，确认后我开工。
