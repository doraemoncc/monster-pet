# 日期条历史切换 + UTC 归档时区偏移修复

> 状态：**已确认口径并实施**（2026-11-24）。用户在本轮确认「两个都修（推荐）」：日期条可切历史日期 + 日期圆点/统计按本地日期归档。
> 来源：`docs/completed-tasks-view-design.md` 第 2/3/6 节明确标注的两个既有遗留 bug，上一轮按方案「绕开不修」，本轮单独处理。

## 1. 背景与现象

| # | 现象 | 根因 |
|---|---|---|
| 1 | 任务页日期条点历史日期「点了没反应」，永远停在今天 | `renderTasksPage()` 开头 `if (!selectedDate \|\| !isToday(selectedDate)) selectedDate = new Date()` 把刚选的日期立刻重置回今天（原意是防止跨天残留，副作用是历史切换完全不可用） |
| 2 | 早上 8 点前完成的任务，日期圆点/统计图表被算到**前一天** | `completedAt` 是 UTC ISO；`getDayTaskCounts()` 用 `completedAt.startsWith(key)`、`stats-io.toLocalDate()` 用 `isoStr.slice(0,10)` 归档，GMT+8 早 8 点前 UTC 日期还是昨天 |

上一轮新写的「已完成折叠区 / 打卡流水」已使用 `dateKey(new Date(...))`，不受影响；本轮修复的是**既有**显示链路，让它们与新功能口径一致。

## 2. 技术方案

### 2.1 日期条（历史视图只读）

- `renderTasksPage()` 只在 `selectedDate` 为 `null` 时初始化，**不再强制重置**；
- 「重新进入任务页默认回今天」移到 `window.bus.on('page:enter')`：进入时 `selectedDate = new Date()`、`cvExpanded = false`。页内点日期条不触发 `page:enter`，选择得以保留；
- `dayLabel` 的天数差改用本地午夜 `new Date(`${key}T00:00:00`)` 相减，不再用 `new Date('YYYY-MM-DD')`（UTC 解析）；
- **历史日期视图只读**：`renderTaskCard()` 新增 `readOnly = isHistoryView()`，隐藏「开始 ▶ / 完成 ✓ / 展开 ▼ / ⋮ 更多 / ⛶ 全屏计时 / 📖 选书」，改显示「📅 历史只读」徽章；子任务区不展开。理由：每日任务跨天被 `resetRepeatTasks()` 原地重置，历史日期上的任务对象不属于那天，不能让孩子在历史视图里点完成（否则会写进今天的 `completedHistory`）；
- 空态文案区分历史：「这天的任务已归档，往下看「✅ 已完成」记录吧~」；已完成折叠区本来就按 `selectedDate` 过滤，切到历史日期即可看到那天的完成记录；
- 挑战区仍只在今天显示；**兑换区改为只受分类影响**（`currentCategory==='all'` 即显示），否则切到历史日期「🎁 我的奖励兑换」会凭空消失——兑换资格是长期状态，不归属某一天。

### 2.2 时区归档（本地日期）

- `task-list.js getDayTaskCounts()`：`dateKey(new Date(h.completedAt)) === key`，并过滤 `completedAt` 缺失/非法日期；
- `stats-io.js`：新增 `localDateStr(d)`（本地 `YYYY-MM-DD`），`toLocalDate(iso)` 改为 `localDateStr(new Date(iso))`，`getDateStr()` 改为 `localDateStr(new Date())`（导出文件名不再差一天）；`shortDate('')` 返回空串防 `NaN/NaN`；
- `getRangeStart()` 原本就是「本地 0 点 → `toISOString()`」再与 UTC ISO 比较，**逻辑正确，不动**。

### 2.3 明确不动（重要）

同类 UTC 写法在 `store.js`（跨天重置、周计划生成、早鸟判断，10+ 处）、`weekly-plan.js`（4 处）、`data-io.js`（导出 CSV 日期列）、`parent-panel.js`、`app.js` 里仍有。这些属于**任务生成核心链路**，历史上踩过任务重复 bug，本次一律不碰，另开需求全量统一。

**已知残留**：`data-io.js` 导出的「任务明细 CSV」日期列仍按 UTC 归档（早 8 点前会差一天）；`stats-io.js` 的统计 tab 与 CSV 已修复。`resetRepeatTasks()` 用 UTC 日期判断跨天，GMT+8 早 8 点前可能出现「新一天但按昨天重置」的边界问题，属于另一条链路，需单独评估。

## 3. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/task-list.js` | `isHistoryView()`；`renderTasksPage()` 初始化/dayLabel；`page:enter`；`getDayTaskCounts()`；`renderTaskCard()` 只读；空态文案；`rewardHtml` 独立渲染 |
| `js/stats-io.js` | `localDateStr()` / `toLocalDate()` / `getDateStr()` / `shortDate()` |
| `css/task.css` | `.task-history-badge` |
| `monster-pet/` | 同步上述 js / css / 本文档 |

不新增 JS/CSS 文件，不动 `index.html`。

## 4. 防回退

- **绝不能把「强制重置回今天」加回 `renderTasksPage()`**：那是历史切换失效的根因。跨天/重新进入的默认今天由 `page:enter` 负责。
- 归档一律 `dateKey(new Date(...))` 或 `localDateStr()`；**禁止** `slice(0,10)` / `startsWith(key)` / `new Date().toISOString().slice(0,10)`。
- 历史视图必须保持只读：任何新增的任务卡交互按钮都要带 `!readOnly` 条件，否则会在历史日期上写入今天的完成记录。
- `getRangeStart()` 用本地 0 点转 UTC ISO 比较是**正确**的，不要「顺手改成 dateKey 字符串」而破坏范围过滤。
- 兑换区与挑战区解耦：挑战只在今天显示，兑换区长期显示。
- 改完 `node --check js/task-list.js js/stats-io.js`；空 localStorage 首开验证任务仍正常生成；对照 `docs/monster-pet-design.md` 第十一章。

## 5. 验证（Playwright 无头）

1. 空态首开：默认今天、日期条选中今天、任务正常生成。
2. 点日期条选昨天 → `selectedDate` 保持昨天、`dayLabel` 显示「昨天」、日期条选中态切换、主列表不报错、折叠区标题变成「11/23 已完成 N 项」。
3. 历史只读：历史视图里的任务卡没有开始/完成/更多/选书/计时按钮，只有「📅 历史只读」徽章；挑战区不显示、兑换区仍显示。
4. `page:enter('tasks')` 后回到今天；「回到今天」按钮同样生效。
5. UTC 边界：塞一条本地早 7:30 完成记录 → `getDayTaskCounts(今天).completed` 包含它、昨天为 0；`stats-io.toLocalDate()` 返回本地今天；`getDateStr()` 返回本地今天。
6. 统计聚合：`aggregateByDate()` 把早 7:30 记录归到今天分组，近 7 天范围过滤仍正确。
7. 不受影响：今天视图按钮齐全、挑战区/兑换区/打卡流水弹窗/分类筛选/任务生成与改动前一致；`pageErrors=[]`。
8. 边界：根目录与 `monster-pet/` 一致、`node --check` 通过、本地无 SW 注册。
