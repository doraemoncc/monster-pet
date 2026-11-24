# 普通任务「已完成任务查看」设计文档

> 状态：**方案已确认为 A（只读查看），2026-11-24 实施完成**。按用户约定：功能改动先完善方案设计文档、check 后再实施代码。
> 触发反馈：「普通的任务，每天完成的打卡任务还要支持显示查看，因为有时候孩子会说今天没有某某任务，可能是她偷偷点了完成，那么那个任务就不再显示了」。
> 前置状态：挑战实物奖励（A 方案）已实施并同步、Playwright 29/29 通过，**未推送 git**；本方案与它无耦合。

## 1. 背景与目标

孩子只要点一次「完成 ✓」，任务就从任务列表消失，家长无法核对「今天到底做了哪些、什么时候做的」。特别是每日重复任务，点完就没了，第二天又重新出现，历史完全无痕。

**目标**：让**已完成**的普通任务（不含挑战）可被查看——今天一眼能核对，历史某天也能翻；只读展示，不改变现有完成/发币/解锁逻辑。

**明确不做**：不改 `completeTask()` 的星币计算、不动门卫解锁、不动周计划任务生成。

## 2. 现状调研（关键结论）

| 项 | 现状 |
|---|---|
| **现象根因** | `task-list.js:312 renderTaskList()` 过滤 `if (t.status !== 'pending' && t.status !== 'active') return false` → `status='completed'` 的任务**立刻从列表消失** |
| tasks 状态 | `store.completeTask()` 把 `task.status='completed'`、写 `completedAt` / `duration` / `coinsEarned`，但**跨天会被抹掉**：`resetRepeatTasks()`（store.js:706）对 daily/weekly 任务原地重置 `status='pending'`、清空 `completedAt/duration/coinsEarned`、设 `lastResetDate=today` → **昨天完成过什么，tasks 里查不到** |
| **唯一持久数据源** | `completedHistory`（store.js:370）：每次完成 `unshift` 一条快照 `{taskId,title,category,coins,exp,duration,startedAt,completedAt,isEarlyBird,bonusDetail}`，**不会随跨天重置删除**，无条数上限 |
| 完成时间格式 | `completedAt = new Date().toISOString()`（**UTC**）。项目在 GMT+8，`completedAt.slice(0,10)` / `startsWith(key)` 在早上 8 点前会算成**前一天** |
| 既有日期圆点 | `getDayTaskCounts()`（task-list.js:129）用 `h.completedAt.startsWith(key)` → 已有上述时区偏移问题；`stats-io.js:47 toLocalDate()` 名字叫 local，实际也是 `slice(0,10)`（同问题） |
| **日期条历史切换不可用** | `renderTasksPage()` 开头 `if (!selectedDate \|\| !isToday(selectedDate)) selectedDate = new Date();` → 点日期条选了历史日期，`renderTasksPage()` 立刻把它重置回今天。**历史日期实际切不过去**（既有 bug） |
| 家长面板「💰 积分」 | `renderCoinsManagement()`（parent-panel.js:1830）有「最近完成记录」但只取前 10 条，**无日期、无完成时间、无分类** |
| 家长面板「📊 统计」 | `stats-io.js` 有近 7/30 天按日聚合 + `renderDayDetail()` 每日明细，但入口深（先进家长面板密码 → 统计 tab），明细里也**没有每条的完成时刻** |
| 可用工具 | `dateKey(date)`（task-list.js:40）返回**本地** `YYYY-MM-DD`；`escapeHtml()` 全局；`.overlay` 弹窗；`window.showConfirm()`；`CATEGORIES` |
| 事件刷新 | `data:changed` 里 `key.includes('tasks')` 会触发 `renderTaskList()`；`completedHistory` 这个 key **不会**触发列表刷新（但 `completeTask` 随后 `set('tasks')` 会） |

**两条硬结论**：
1. 查看历史必须读 `completedHistory`，**不能**读 `tasks`；
2. 归档日期必须用 `dateKey(new Date(h.completedAt))` 本地化，**绝不**复用 `toISOString().slice(0,10)` / `startsWith(key)` 的写法。

## 3. 技术方案（推荐 A）

### 3.1 数据来源与归档

新增 `getCompletedRecordsLocal()`（放在 `task-list.js`，`cv-` 前缀命名）：

```js
// 返回 [{..., _day:'2026-11-24', _time:'19:42', _ts: 1732452120000}]
const history = window.store.get('completedHistory') || [];
return history
  .filter(h => h && h.completedAt && !isNaN(new Date(h.completedAt).getTime()))
  .map(h => {
    const d = new Date(h.completedAt);
    return { ...h,
      _day: dateKey(d),                                  // 本地日期（关键）
      _time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
      _ts: d.getTime() };
  })
  .sort((a, b) => b._ts - a._ts);
```

- 只读，**不写任何 store 字段**（不新增数据模型、不需要迁移）；
- 渲染前 `slice(0, 200)` 限量，避免 `completedHistory` 上万条时卡顿；
- 分类筛选跟随 `currentCategory`，用 `h.category` 匹配。

### 3.2 孩子/家长共用：任务页「✅ 已完成」折叠区

在 `renderTaskList()` 生成的 HTML 末尾（挑战区之前）追加一块：

```
┌─ ✅ 今天已完成 3 项            [📋 全部记录] ⌄ ┐
│  19:42  语文听写      📖 阅读   💰5   12分   │
│  18:10  数学口算      🏫 学校   💰5   🌅    │
│  07:30  钢琴练习      🎹 兴趣   💰5   25分   │
└──────────────────────────────────────────────┘
```

- **默认折叠**（只显示一行「✅ 今天已完成 N 项」+ 展开箭头），点开看明细，避免任务页变长；
- 每行显示：完成时刻、任务名、分类 emoji、获得星币、用时、🌅早鸟标记；全部 `escapeHtml()`；
- 标题随 `selectedDate` 变化：今天显示「今天已完成」，历史日期显示「11/23 已完成」；
- 「📋 全部记录」按钮打开 3.3 的流水弹窗；
- 无记录时显示「今天还没有完成的任务」。

### 3.3 「📋 打卡流水」弹窗（历史翻查，绕开日期条 bug）

因为日期条切换历史日期有既有 bug，**本次不复用日期条、也不修它**（防止牵动周计划/门卫逻辑），改为独立弹窗：

```
┌─ 📋 打卡流水 ─────────────────── ✕ ┐
│ [今天] [近7天] [近30天] [全部]     │
│ ── 11/24 周一 · 3 项 · 💰15 ──    │
│   19:42 语文听写   📖  💰5  12分  │
│ ── 11/23 周日 · 2 项 · 💰10 ──    │
│   20:01 数学口算   🏫  💰5  🌅   │
└────────────────────────────────────┘
```

- 按 `dateKey` 分组、日期倒序、组内按时间倒序；
- 范围按钮只过滤显示，不改数据；「今天」= `dateKey(new Date())`；
- 弹窗沿用 `.overlay` + `.modal`（与兑换券弹窗同风格，z-index 400 防被结果弹窗盖住）；
- 只读，**没有任何修改/删除按钮**（A 方案口径）。

### 3.4 家长面板「最近完成记录」补时间

`renderCoinsManagement()` 里最近 10 条补上 `MM/DD HH:mm`，并加一个「查看全部打卡流水 →」按钮，复用同一个弹窗函数（挂到 `window.openCompletedHistoryModal`），让家长不用回任务页也能查。

### 3.5 明确不动的东西

- `store.completeTask()` / `resetRepeatTasks()` / `isTodayAllDone()` / 门卫解锁 / 连击 / 星币发放置**完全不动**；
- 周计划生成 `reconcileTodayTasks()`、`weekly-plan.js` 不动（历史踩过任务重复 bug）；
- 日期条 `renderTasksPage()` 的"非今天重置回今天"逻辑**本次不修**（独立既有问题，改动会牵连页面进入/刷新时机，另开需求处理）；
- 挑战卡片、实物奖励兑换区、阅读书目、全屏计时全部不动；新增 DOM 用 `cv-` 前缀，不混入 `.task-card` 事件绑定；
- `completedHistory` 的写入格式、数据导出/导入逻辑不动。

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/task-list.js` | 新增 `cvGetRecords()` / `cvFormatDuration()` / `renderCompletedSection()` / `openCompletedHistoryModal()`；`renderTaskList()` 末尾追加折叠区；新增展开/弹窗事件绑定；弹窗函数挂到 `window` 供家长面板调用 |
| `js/parent-panel.js` | `renderCoinsManagement()` 最近记录补日期时间 + 「查看全部打卡流水」按钮与事件 |
| `css/task.css` | `.cv-section` / `.cv-row` / `.cv-modal` / `.cv-day-group` 等（折叠区 + 流水弹窗）；窄屏适配 |
| `css/parent.css` | 最近完成记录的时间文字样式 |
| `docs/completed-tasks-view-design.md` | 本文档 |
| `monster-pet/` 子目录 | 同步上述 js / css / docs |

**不新增 JS/CSS 文件**（避免 `index.html` 两个目录漏同步）；`store.js` / `stats-io.js` / `data-io.js` 不动。

## 5. 实施步骤

1. 确认第 8 节口径：用户回复「按 A」，采用默认口径，不改完成/发币/解锁逻辑。
2. `task-list.js`：本地日期归档函数 → 折叠区渲染 → 流水弹窗 → 事件绑定 → 挂 `window`。
3. `parent-panel.js`：最近记录补时间 + 跳转按钮。
4. 两处 CSS（`cv-` 前缀）。
5. 同步 `monster-pet/`；`node --check` 全部改动 JS。
6. Playwright 无头验证（第 7 节）+ 空 localStorage 首开验证。
7. 发本地预览链接（说明对应版本）；**不推送**，等用户明确说「推送git」。

## 6. 防回退

- **本地日期是本次最大坑**：归档一律 `dateKey(new Date(h.completedAt))`；显示时刻用 `getHours()/getMinutes()`；**绝不**用 `completedAt.slice(0,10)` 或 `startsWith(key)`（GMT+8 早 8 点前会归到前一天）。不修既有的 `getDayTaskCounts()` / `stats-io.toLocalDate()`，但新代码不复制它们。
- `completedHistory` 可能被旧数据/导入数据污染：过滤掉 `completedAt` 缺失或 `new Date()` 为 Invalid Date 的记录；`title` / `category` 全部 `escapeHtml()`；`coins` / `duration` 用 `Number(...) || 0` 兜底。
- `completedHistory` 只增不减，弹窗渲染前必须限量（默认 200 条），否则长期使用会卡。
- 折叠状态用**局部变量**（`let cvExpanded = false`）即可，不写 localStorage，避免又引入一个持久化字段；刷新页面回到默认折叠。
- `renderTaskList()` 仍只显示 `pending/active` 任务，**不要把 completed 混进主列表**——否则 `isTodayAllDone()` 之外的界面语义会乱，也容易让孩子"再点一次完成"。已完成只在只读折叠区出现。
- `data:changed` 的 `completedHistory` key 不触发刷新 → 在 `completeTask()` 之后已有 `set('tasks')` 兜底；但为稳妥，把 `key.includes('completedHistory')` 也加进刷新条件（只加一个 `||`，不改其他逻辑）。
- 新增 DOM 统一 `cv-` 前缀，事件绑定用 `listEl.querySelectorAll('.cv-*')`，不碰 `.task-card` 循环；`const` 不在同一作用域重复声明（书库增删失效的教训：一个 `ReferenceError` 会让整页静默失败）。
- 改完 `node --check js/task-list.js js/parent-panel.js`；对照 `docs/monster-pet-design.md` 第十一章；**空 localStorage 首次打开**验证任务生成不受影响。
- 预览必须用 `python3 preview-server.py 8099`（no-store），本地不注册 SW。

## 7. 验证方案（Playwright 无头）

1. **空记录**：新用户首次打开 → 折叠区显示「今天还没有完成的任务」，主列表正常生成任务，`pageErrors=[]`。
2. **完成后可见**：预置 3 条任务，点「完成 ✓」1 条 → 主列表少 1 条、折叠区计数变 1，明细含任务名、本地时刻、💰星币。
3. **UTC 边界**：人工塞一条 `completedAt` 为本地早上 7:30 的记录（UTC 是前一天 23:30）→ 归档到**今天**，不落到昨天。
4. **历史翻查**：塞昨天/前天/30 天前的记录 → 流水弹窗按日期倒序分组，范围按钮过滤正确。
5. **分类筛选**：切到「阅读」分类 → 折叠区只剩该分类记录。
6. **脏数据**：混入 `completedAt:null` / 非法日期 / 带 HTML 的标题 → 不报错、不执行脚本、渲染为转义文本。
7. **家长面板**：最近完成记录显示 `MM/DD HH:mm`；点「查看全部打卡流水」能打开同一弹窗。
8. **不受影响**：`isTodayAllDone()` / 门卫解锁 / 挑战区 / 实物奖励兑换区 / 日期条行为与改动前一致。
9. **边界**：根目录与 `monster-pet/` 文件一致、`node --check` 通过、本地无 SW 注册。

## 8. 待确认口径（只问一个问题）

**这次做到哪一步？**

- **A. 只读查看（推荐）**：任务页加「✅ 已完成」折叠区 + 独立「📋 打卡流水」弹窗可翻历史，家长面板补完成时间。**完全不动完成/发币/解锁逻辑**，风险最低，直接解决"核对今天有没有偷偷点完成"。
- **B. A + 家长可撤销误点**：额外在家长面板加「↩️ 撤销这次完成」——把任务恢复 `pending`、删掉对应 `completedHistory`、扣回该次星币。**注意**：宠物经验、连击 `streak`、宠物进化/生病、额外喂食次数都是完成时联动产生的，**精确回滚不了**，只能做"业务取舍"（例如只扣星币不回滚经验）。若选 B，需再确认这个取舍。
- **C. 只放家长面板**：任务页完全不动，家长面板新增「📋 打卡流水」tab（带日期筛选）供家长查，孩子看不到。改动最集中，但每次核对都要先输密码进家长面板。

若选 A，以下为**默认口径**，不同意请一并说明：

- 折叠区默认**折叠**，点开看明细；「全部记录」弹窗可看近 7/30 天/全部；
- 数据源只用 `completedHistory`（tasks 跨天会被重置，不作为历史依据）；
- 每条显示：完成时刻、任务名、分类、星币、用时、早鸟；只读，无任何修改/删除按钮；
- **本次不修**日期条"历史日期切不过去"的既有 bug（另开需求），历史查看走独立弹窗；
- 家长面板「最近完成记录」补上日期时间，并加一个跳到流水弹窗的入口。

**结论（2026-11-24）：用户已确认「按 A」**，上述默认口径全部生效，B（撤销误点）与 C（只放家长面板）未采用。

## 9. 实施记录

- `js/task-list.js`：新增 `cvGetRecords()` / `cvFormatDuration()` / `cvRowHtml()` / `renderCompletedSection()` / `cvRangeCutoff()` / `cvRenderModalBody()` / `openCompletedHistoryModal()`；`renderTaskList()` 在任务卡与挑战区之间插入只读折叠区，`data:changed` 刷新条件补 `completedHistory`；弹窗函数挂 `window` 供家长面板复用。
- `js/parent-panel.js`：新增 `cvParentTime()`；最近完成记录补本地 `MM/DD HH:mm`、标题改 `escapeHtml()` 转义，新增「📋 查看全部打卡流水 →」按钮。
- `css/task.css` / `css/parent.css`：`cv-` 前缀样式，弹窗 `z-index:400`。
- 归档一律 `dateKey(new Date(h.completedAt))`；未修既有 `getDayTaskCounts()` / `stats-io.toLocalDate()` 与日期条历史切换 bug（另开需求）。
- 流水弹窗默认范围 `all`（最多最近 200 条），范围按钮「今天 / 近7天 / 近30天 / 全部」只过滤显示。
