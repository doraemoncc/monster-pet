# 挑战任务进入每日任务列表 设计文档

> ⚠️ **v2 修订已另行编写**：用户后续要求「挑战默认不进每日任务、需家长推送才显示、孩子端不再只能点接受」。方案见 `challenge-push-to-daily-design.md`。本文保留 v1 调研与实施记录备查。
>
> 状态：**已实现并验证，未推送**（2026-11-24，v1）。用户选定 **B. 展示+接受/完成**；其余按默认：去掉 5 条预置示例、只在"今天"视图显示、选「全部」分类时出现。无头验证 9 项全过、`pageErrors=[]`。

### 实施补充（与方案的差异）
- **完成加了二次确认**：家长面板对已完成挑战只能「删除」、无法标回未完成，孩子误点完成不可逆 → `completeChallenge()` 先 `await window.showConfirm(...)`。
- **空态带可点击引导**：新增 `window.openChallengesTab()`（parent-panel.js）定位到「🏆 挑战」tab，与阅读书目那套一致。
- **完成奖励**：`user.coins += bonusCoins` + `grantBonusInteraction('both')` + 刷新金币显示；不写 `completedHistory`、不动 `isTodayAllDone()`。
- **发现既有问题（未修，非本次引入）**：`renderTasksPage()` 开头 `if (!selectedDate || !isToday(selectedDate)) selectedDate = new Date()` 会把日期条上点击的非今天日期强制拉回今天，用户实际切不到历史日期。本次"只在今天显示"因此始终成立，不影响功能；若日后要做历史日期查看需单独修。

### 验证结果（Playwright 无头）
全新 0 挑战+空态引导 ✓；新建 2 条正确显示 ✓；接受→状态「🔄进行中」+出现完成按钮 ✓；完成→`completed/completedAt`、金币 +20、卡片剩 1 ✓；历史日期隐藏 ✓；具体分类隐藏/「全部」出现 ✓；`isTodayAllDone()` 不受影响 ✓；无页面报错 ✓。

## 1. 背景与目标

用户反馈：「挑战任务现在没有出现在每日任务列表中，现在把挑战任务也加到每日任务中进行显示的展示」。

目标：让孩子在**每日任务页**能看到家长设置的挑战任务（不再需要单独入口/弹窗）。

## 2. 现状调研（根因）

| 项 | 现状 |
|---|---|
| 挑战数据 | `store.get('challenges')`，独立数组，字段 `{id, title, description, bonusCoins, accepted, completed, completedAt, weeklyReset, isChallenge}` |
| 每日任务 | `store.get('tasks')`，另一套数组，按 `status=pending/active` + 日期(`lastResetDate`/`createdAt`) 过滤 |
| 孩子端展示 | `js/task-list.js:968 showChallenges()` 有完整面板（含「接受」按钮），但**全项目无调用点**，是死函数，界面上完全看不到 |
| 家长端 | `js/parent-panel.js` 「🏆 挑战」tab 可增删改；`DEFAULT_DATA.challenges` 预置 5 条示例 |
| 完成逻辑 | **无**。接受后 `accepted=true` 永远"进行中"，`completed` 恒 false，`bonusCoins` 无发放路径 |
| 解锁判定 | `store.isTodayAllDone()` 只遍历 `tasks`，与 `challenges` 无关 → 加展示不会破坏商城/宠物乐园门卫 |
| 分类筛选 | `CATEGORIES` 只有 school/tutoring/hobby/reading/other，**没有 challenge**；`renderTaskList()` 分类过滤会把非当前分类的任务剔除 |
| 日期筛选 | 挑战是跨天长期目标（"连续3天""一周读完2本"），**没有日期字段**，按现有日期过滤会被直接剔除 |
| 历史遗留 | `css/task.css:664 .btn-challenge` 样式存在但无任何引用（曾经的入口按钮被删） |

**根因一句话**：挑战是独立数据 + 独立死面板，从未接入每日任务列表的渲染链路。

## 3. 技术方案

### 3.1 推荐口径（待确认，见第 8 节）

- **形式**：在 `#tasks-list` 里、今日任务卡片之后，追加一个独立的「🏆 挑战」分组区块（不混入普通任务卡片流）。
- **显示范围**：显示所有**未完成**的挑战（`!completed`），含"未接受"和"进行中"；已完成的挑战不显示（保持列表清爽）。
- **只在"今天"视图显示**：切到历史/未来日期时不显示挑战（挑战是长期目标，不属于某一天）。
- **分类筛选**：选择「全部」时显示挑战区块；选具体分类时隐藏（挑战不属于任何现有分类），或另加「🏆 挑战」分类按钮。
- **卡片信息**：标题、描述、💰奖励星币、状态徽章（🎯 待接受 / 🔄 进行中）。
- **默认示例挑战**：沿用与"默认书单"一致的思路——**建议去掉 5 条预置示例**，首次为空并显示引导"请家长到家长面板添加挑战"。与上一版"不要设置默认的书单"口径一致。

### 3.2 交互范围（三选一，见第 8 节）

- **A. 只读展示（最小改动，推荐）**：卡片只展示信息，不带按钮。孩子看得见，接受/完成仍留待后续。
- **B. 展示 + 接受/完成**：卡片带「接受」「完成」按钮；完成 → `completed=true` + `completedAt` + 发放 `bonusCoins`（走 `store.addCoins` 类方法）+ 额外互动奖励。需新增 `completeChallenge()`。
- **C. 并入任务流**：把 challenges 合并进 tasks 数组作为特殊任务，走现有 `startTask/completeTask`。改动最大，涉及数据迁移，不推荐。

### 3.3 不动的东西（防回退重点）

- `isTodayAllDone()` / 门卫解锁逻辑 **不改动**：挑战不计入"今日全部完成"。
- `getDayTaskCounts()` 日期圆点统计 **不改动**。
- 家长面板「🏆 挑战」tab 的增删改 **不改动**。
- 现有任务卡片 `renderTaskCard()` **不改动**，挑战用独立的 `renderChallengeCard()`。

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/task-list.js` | 新增 `getActiveChallenges()`、`renderChallengeSection()`、`renderChallengeCard()`；`renderTaskList()` 末尾追加挑战区块；分类/日期显示条件 |
| `js/store.js` | `DEFAULT_DATA.challenges` 改 `[]`（若确认去默认）；`_migrate()` 只补字段不播种示例 |
| `css/task.css` | 新增 `.challenge-section` / `.challenge-card` 系列样式（复用现有 `.challenge-*` 配色） |
| `docs/challenge-in-daily-tasks-design.md` | 本文档 |
| `monster-pet/` 子目录 | 同步上述 js/css/docs |

## 5. 实施步骤

1. 确认第 8 节口径。
2. `store.js`：按确认结论处理默认示例挑战。
3. `task-list.js`：实现挑战区块渲染与显示条件；空态引导。
4. `css/task.css`：样式。
5. 同步 `monster-pet/` 子目录；`node --check` 全部 JS。
6. Playwright 无头验证（见第 7 节）。
7. 发预览链接（本地最新版）；**不推送**，等用户明确说"推送git"。

## 6. 防回退

- **挑战不得写入 `tasks` 数组**：两套数据保持独立，避免污染 `isTodayAllDone()` 与周计划任务生成/重置逻辑（历史踩坑：`reconcileTodayTasks` 统计模板计数曾导致任务重复）。
- 新增 DOM 用独特类名前缀 `challenge-section`/`challenge-card`，不与 `.task-card` 混用，避免事件绑定 `querySelectorAll('.task-card')` 误绑。
- 变量命名避开 `parent-panel.js` 里已有的 `challenges`/`ch` 局部作用域；`task-list.js` 顶层新增变量一律加前缀或用局部 `const`。
- 脚本改动后必须 `node --check js/task-list.js`（历史踩坑：`const` 重复声明导致整页静默空白）。
- 改完对照 `docs/monster-pet-design.md` 第十一章检查清单。

## 7. 验证方案（Playwright 无头）

1. 全新数据 → 每日任务页出现「🏆 挑战」区块；无示例挑战时显示引导文案。
2. 家长面板新建 1 条挑战 → 回任务页，挑战出现在区块里（标题/描述/💰/状态正确）。
3. 接受挑战（若选方案 B）→ 状态变「进行中」。
4. 完成挑战（若选方案 B）→ 从列表消失、`completed=true`、金币增加。
5. 切到历史日期 → 挑战区块不显示。
6. `isTodayAllDone()` 不受挑战影响；普通任务全部完成仍能解锁商城。
7. `pageErrors=[]`。

## 8. 待你确认的口径

请回答一个问题即可（其余按上面的推荐默认执行）：

**挑战任务以什么形式加入每日任务列表？**

- **A. 只读展示（推荐）**：独立「🏆 挑战」分组，显示未完成挑战的名称/描述/奖励/状态，纯展示，不带按钮。改动最小，只解决"看得见"。
- **B. 展示 + 接受/完成**：卡片带「接受」「完成」按钮，完成后标记完成、发放星币奖励，挑战真正可用。
- **C. 并成普通任务**：挑战合并进任务数组，走现有开始/完成流程（改动最大，需数据迁移，不推荐）。

另有两个默认口径，若不同意请一并说明：
- ① **去掉 5 条预置示例挑战**，首次为空并引导家长添加（与"不要默认书单"一致）；
- ② 挑战**只在"今天"视图显示**，切到历史/未来日期不显示；选「全部」分类时才出现。

回复「按 A 来」/「按 B 来」或说明调整即可，确认后我开工。
