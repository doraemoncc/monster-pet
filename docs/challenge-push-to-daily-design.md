# 挑战任务「推送到每日任务」机制 设计文档（v2 修订）

> 状态：**已实现并验证，未推送**（2026-11-24）。无头验证 13 组检查全过、`pageErrors=[]`。用户选定 **B. 接受和完成两个按钮都在**（未接受时显示「接受挑战 ▶」+「完成 ✓」，接受后只留「完成 ✓」+ 进行中徽章）；其余按默认口径。本文是 `challenge-in-daily-tasks-design.md` 的 v2 修订。
> 触发反馈：「现在默认的挑战任务和新的挑战都会出现在每日任务中，且处理时候只能选择接受挑战，这不合理；家长面板默认的挑战不要出现在每日任务，只有推送到每日任务时才需要显示」。

## 1. 背景与目标

v1 把挑战接入了每日任务页，但采用"所有未完成挑战自动全部显示"的口径，导致：

1. 家长面板里的**挑战库**（含老数据残留的 5 条预置示例 + 新建的）全部自动涌进孩子的每日任务页，家长无法控制今天给孩子哪几条。
2. 未接受的挑战卡片上**只有「接受挑战」一个动作**，孩子不能直接完成/打卡，交互多一步且不合理。

**目标**：把挑战拆成「家长面板的挑战库」与「孩子每日任务」两层，中间由家长显式「推送」控制；推送后的挑战在孩子端可直接完成。

## 2. 现状调研（v1 实现)

| 项 | 现状 |
|---|---|
| 数据 | `store.challenges`，字段 `{id,title,description,bonusCoins,accepted,completed,completedAt,weeklyReset,isChallenge}`，**没有推送状态字段** |
| 默认值 | `DEFAULT_DATA.challenges = []`（v1 已去掉 5 条预置示例）；但 `_migrate()` 只补类型、**不清老数据**，所以老用户 localStorage 里仍留着旧版 5 条示例挑战 |
| 孩子端筛选 | `task-list.js:432 getActiveChallenges()` = `filter(ch => !ch.completed)` → 全量显示 |
| 孩子端交互 | 未 `accepted` 只渲染「接受挑战 ▶」；`accepted=true` 才渲染「完成 ✓」 |
| 完成逻辑 | `completeChallenge()`：二次确认 → `completed/completedAt` → 发 `bonusCoins` 星币 + `grantBonusInteraction('both')`，卡片消失 |
| 家长端 | `renderChallengeManagement()` 只有 ✏️编辑 / 🗑️删除，**没有推送入口**；提示文案还写着"显示在孩子的每日任务页" |
| 显示条件 | 只在「今天」视图 + 「全部」分类显示；不写入 `tasks`、不影响 `isTodayAllDone()` |

**根因一句话**：缺少「是否推送」状态与家长端推送入口，孩子端因此全量显示、且用 `accepted` 当唯一交互门槛。

## 3. 技术方案

### 3.1 数据模型：新增 `pushedToDaily`

在 challenge 对象上加两个字段（其余字段不动，向下兼容老数据）：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `pushedToDaily` | boolean | `false` | 是否已推送到孩子每日任务；**唯一显示开关** |
| `pushedAt` | string \| null | `null` | 推送时间（ISO），仅用于家长面板展示/排查 |

- `store._migrate()`：遍历已有 challenges，`pushedToDaily === undefined` 时补 `false`（**绝不自动设 true**，否则老数据里的 5 条示例又会全冒出来）。
- 新建挑战（`openChallengeEditor`）显式写入 `pushedToDaily: false, pushedAt: null`。
- `accepted` 字段保留为孩子端**可选动作**的状态：推送时**不动它**（保持 `false`，这样孩子端「接受」+「完成」两个按钮都在）；撤回时重置为 `false`，下次推送可重新接受。

### 3.2 家长面板（挑战库）

- 顶部提示改为：「💡 这里是挑战库。点「📤 推送」后，挑战才会出现在孩子的每日任务页；完成不可撤销」。
- 每条未完成挑战新增按钮：
  - 未推送 → 「📤 推送到每日任务」（点击设 `pushedToDaily=true`、`pushedAt=now()`、`accepted=true`）
  - 已推送 → 「↩️ 撤回」（设回 `false`/`null`，孩子端立即不再显示）
- 徽章改为「✅ 已推送 / 未推送 / 已完成」三态，不再显示"进行中"。
- 已完成的挑战：不显示推送按钮（完成不可逆，如需再做请新建一条）。
- 保留 ✏️编辑 / 🗑️删除，行为不变。

### 3.3 孩子端（每日任务页）

- `getActiveChallenges()` 改为 `filter(ch => !ch.completed && ch.pushedToDaily === true)`。
- **用户选定 B：接受与完成两个按钮都在**。未 `accepted` 的卡片同时渲染「接受挑战 ▶」+「完成 ✓」；已 `accepted` 的只渲染「完成 ✓」并显示「🔄 进行中」。完成按钮始终可直接点（保留二次确认，因为家长端无法把已完成标回未完成）。
- 卡片状态文案：未接受显示「🎯 今日挑战」、已接受显示「🔄 进行中」。
- 空态文案改为「还没有推送到每日任务的挑战，请家长到「家长面板 → 🏆 挑战」点推送」；引导按钮文案「去推送挑战」，跳转逻辑沿用 `window.openChallengesTab()`。
- 显示条件不变：只在「今天」视图 + 「全部」分类；区块始终保留（哪怕空），方便引导。

### 3.4 生效范围（默认口径）

- 推送后**一直显示**，跨天也在，直到「完成」或家长「撤回」——与"手选在读书一直显示到读完"保持一致，不用天天推送。
- 完成后 `completed=true` → 自动从孩子端消失，`pushedToDaily` 保持 true 不再起作用。

### 3.5 明确不动的东西（防回退）

- 挑战**不写入 `tasks`**，不进完成历史，不参与 `isTodayAllDone()` / 门卫解锁。
- `getDayTaskCounts()` 日期圆点统计不动。
- 「只在今天 + 全部 分类显示」不动。
- `completeChallenge()` 的发币/二次确认逻辑不动，只改卡片触发入口。
- 老数据里的 5 条示例挑战**不删**：留在家长面板作为挑战库内容，因 `pushedToDaily=false` 不会出现在孩子端（避免误删用户数据，也呼应"不自动播种/不清历史"的既有口径）。

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/store.js` | `_migrate()` 补 `pushedToDaily: false` / `pushedAt: null`（仅补字段，不播种、不自动推送） |
| `js/parent-panel.js` | `renderChallengeManagement()` 加推送/撤回按钮 + 事件 + 三态徽章 + 提示文案；`openChallengeEditor()` 新建时写入新字段 |
| `js/task-list.js` | `getActiveChallenges()` 加推送过滤；卡片去掉「接受」只保留「完成 ✓」；空态文案/按钮文案；删除 `acceptChallenge()` 及其事件绑定 |
| `css/parent.css` | 推送按钮、已推送徽章样式（复用 `.tpl-*-btn` 或新增 `.ch-push-btn`） |
| `css/task.css` | 挑战卡片状态微调（去掉 `.accepted` 态依赖，按需） |
| `docs/challenge-push-to-daily-design.md` | 本文档；原 v1 文档顶部加指引 |
| `monster-pet/` 子目录 | 同步上述 js / css / docs |

## 5. 实施步骤

1. 确认第 8 节口径。
2. `store.js` 迁移补字段。
3. `parent-panel.js` 推送/撤回按钮与事件。
4. `task-list.js` 过滤 + 去掉接受步骤。
5. CSS 两处样式。
6. 同步 `monster-pet/`；`node --check` 全部改动 JS。
7. Playwright 无头验证（第 7 节）。
8. 发本地预览链接（说明对应版本）；**不推送**，等用户明确说"推送git"。

## 6. 防回退

- **`pushedToDaily` 迁移默认值必须是 `false`**：若误设 `true`，老用户 5 条示例挑战会在升级瞬间全部涌进每日任务，正是本次要修的 bug。验证必须包含"老数据（无该字段）加载后孩子端 0 条挑战"。
- 孩子端筛选必须**同时**判断 `!completed && pushedToDaily === true`（严格等于，不能用 truthy 兜底成"没字段就显示"）。
- 家长面板新增事件时沿用 `container.querySelectorAll(...)` + `forEach`，注意 `const` 不要在同一作用域重复声明（历史踩坑：书库增删失效就是 `const lang` 作用域错误导致 forEach 中断）。改完必须 `node --check js/parent-panel.js`。
- 新增 DOM 类名继续用 `challenge-*` 独立前缀，不混入 `.task-card` 事件绑定。
- 删除 `acceptChallenge()` 时确认全项目无其它调用点（`showChallenges()` 死面板可能引用）。
- 改完对照 `docs/monster-pet-design.md` 第十一章检查清单。

## 7. 验证方案（Playwright 无头）

1. **老数据兼容**：预置 5 条无 `pushedToDaily` 的旧挑战 → 加载后字段被补为 `false`，每日任务页挑战卡片数 = 0，空态引导出现。
2. **新建不自动显示**：家长面板新建 1 条 → 孩子端仍 0 张卡片。
3. **推送后显示**：点「📤 推送」→ `pushedToDaily=true`、家长端显示"已推送"徽章 + 撤回按钮；孩子端出现 1 张卡片，且**「接受挑战 ▶」与「完成 ✓」两个按钮同时存在**。
4. **撤回**：点「↩️ 撤回」→ 孩子端卡片消失。
5. **完成**：再推送 → 点「完成 ✓」（mock `showConfirm` 为 true）→ `completed=true`、金币增加、孩子端消失、家长端显示"已完成"且不再有推送按钮。
6. **边界**：切到具体分类 → 区块隐藏；`isTodayAllDone()` 不受影响；`pageErrors=[]`。
7. 根目录与 `monster-pet/` 文件一致性、JS 语法校验。

## 8. 待你确认的口径

只需回答一个问题（其余按上面默认口径执行）：

**家长「推送到每日任务」后，孩子在每日任务页怎么操作这张挑战卡？**

- **A. 直接「完成 ✓」（推荐）**：推送即视为已接受，卡片只有一个「完成 ✓」按钮（带二次确认），不再有"接受"这一步。最贴合你说的"只能选择接受不合理"。
- **B. 保留「接受」+「完成」两步**：卡片同时给「接受」和「完成」两个按钮，孩子可先接受、也可直接完成。
- **C. 只读展示**：孩子端只能看，完成由家长在家长面板标记（会需要额外加家长端"标记完成"入口）。

默认口径（不同意请一并说明）：推送后**一直显示**直到完成或撤回；老数据里的 5 条示例挑战保留在家长面板当挑战库、不自动显示。

回复「按 A 来」或说明调整即可，确认后我开工。
