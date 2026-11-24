# 阅读书目「在读标记」机制 设计文档

> 状态：**已实现并验证**（2026-11-18）。无头验证 7 场景全部通过；未推送，待用户明确指令。
>
> **补充变更（2026-11-19）**：按用户要求去掉默认书单——`store.js` `DEFAULT_DATA.readingBooks` 改为 `[]`，`_migrate()` 只在字段缺失/非数组时初始化空数组、空库不再播种示例书。任务卡空提示与选书面板新增「去添加书目」引导按钮（`window.openReadingBooksTab()` 定位家长面板阅读书目 tab）。无头验证 5 场景全过（全新0本/空提示/引导按钮/跳转/删空刷新不复辟），无报错。

## 1. 背景与目标

用户反馈：每日阅读任务里显示的书，"不是我正在读的"。

排查发现当前机制是**按语言池 + 轮转指针顺序取书**，与"孩子当前在读哪本"完全无关：
- 清空数据后书库恢复成 6 本默认示例书，任务就取了按顺序的前两本（《猜猜我有多爱你》《The Very Hungry Caterpillar》）。
- 之前两版把"在读"理解成"未读完"（`!finished`），仍未对上用户意图。

用户确认的真实意图：**在书库里手动标记哪些书是"正在读"的，每日阅读只从标记为在读的书里取；读完一本后换下一本在读的。**

目标：
1. 书库每本书增加「在读」开关，由家长手动指定当前在读的书（可多本）。
2. 每日阅读任务只从"在读且未读完"的书里分配，每种语言取一本。
3. 读完一本书后自动取消它的「在读」标记，自然轮转到下一本在读的书。

---

## 2. 数据模型

`readingBooks` 每本书新增字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| `finished` | boolean | 是否已读完（现有） |
| `reading` | boolean | **新增**：是否"正在读"（家长手动标记） |

- 两字段独立但联动：**标记读完时自动取消 `reading`**（读完就不算在读）；`reading=false` 的书不参与每日分配。
- 状态组合：
  - `reading=true, finished=false` → 📖 在读中（参与分配）
  - `reading=false, finished=false` → 普通待读（不参与分配）
  - `finished=true` → ✓ 已读（`reading` 恒为 false）

### 默认数据 & 迁移
- `js/store.js` `DEFAULT_DATA.readingBooks`：中英各标记第一本为在读（`book_en_1`、`book_cn_1` 加 `reading: true`），保证新用户开箱即用。
- `_migrate()`：老数据缺 `reading` 字段时补 `false`（不猜测，交由家长标记）。

---

## 3. 技术方案

### 3.1 家长面板 · 书库页（`js/parent-panel.js`）
- `renderReadingBooksManagement()` 每本书行增加「📖在读 / 取消在读」切换按钮。
- 在读的书标题前显示 📖 标记，直观区分。
- 点击切换 `reading` 字段 → 写回 store → 重渲染；**无需立刻改今日任务**（当天已分配的书不动，次日分配生效）。
- 顶部加一行说明：在读的书才会出现在每日阅读任务里。

### 3.2 分配逻辑（`js/weekly-plan.js`）
- `assignReadingBooksForTask()` 取书池改为：
  ```js
  const pool = books.filter(b => b.lang === lang && b.reading && !b.finished);
  ```
- 每种语言从"在读且未读完"的池里按 `readingRotation` 指针取一本。
- 指针在池内推进；池为空（该语言无在读书）则该语言不分配。
- **无在读书的降级**：见「待确认口径」第 2 点。

### 3.3 读完联动（`js/task-list.js`）
- `showBookFinishedConfirm()` 确认时：某本书被标为"读完了"(`finished=true`)，同时把它的 `reading` 置为 `false`。
- 这样该书退出在读池，下次分配自动换成下一本在读书——实现用户说的"读完再换下一本"。
- 点"还没"则 `finished=false`，`reading` 保持不变（继续读）。

### 3.4 换书面板（`js/task-list.js`）
- `showBookSwapPanel()` 候选列表只列"在读且未读完"的书（与分配池一致）。
- 当前书已读完时额外保留在列表，避免下拉里凭空消失。

### 3.5 样式（`css/parent.css`）
- 新增 `.book-reading-btn`（在读切换按钮，点亮态橙色）与 `.book-row.reading` 的高亮样式。

---

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/store.js` | DEFAULT_DATA 示例书加 `reading` 字段（中英各一本 true）；`_migrate()` 补 `reading:false` |
| `js/weekly-plan.js` | `assignReadingBooksForTask()` 只从在读且未读完池取书 |
| `js/task-list.js` | 读完联动取消 `reading`；换书候选只列在读书 |
| `js/parent-panel.js` | 书库页加「在读」切换按钮 + 说明文案 |
| `css/parent.css` | 在读按钮/行高亮样式 |
| `docs/reading-active-flag-design.md` | 本文档 |
| `monster-pet/` 对应副本 | 全部同步 |

---

## 5. 实施步骤

1. `store.js` 数据模型 + 迁移。
2. `parent-panel.js` + `css/parent.css` 在读开关 UI。
3. `weekly-plan.js` 分配逻辑改为在读书池。
4. `task-list.js` 读完联动 + 换书候选。
5. 全部同步 `monster-pet/`，`node --check` 校验。
6. Playwright 无头验证。
7. 交付后**不主动推送**，等用户明确"推送git"。

---

## 6. 防回退

- **分配池条件**必须是 `b.reading && !b.finished`，缺一不可：缺 `reading` 就退回旧问题（读谁都分配），缺 `!finished` 会把读完的书再分配。
- **读完联动**：只有确认"读完了"`(finished=true)` 才取消 `reading`；点"还没"不能取消，否则书会凭空从在读书里消失。
- **`lang` 作用域**：`renderReadingBooksManagement` 的 add 事件里 `const lang` 必须在 `forEach` 循环体（回调外）——上次 `lang is not defined` 的根因，改这个函数时极易再踩。
- 双目录同步：`mission/` 与 `monster-pet/` 都要改。

---

## 7. 验证计划（Playwright 无头）

1. 书库标记中英各 2 本在读、1 本不在读 → 重新分配 → 只出现在读的书。
2. 读完某本在读书 → 确认后该本 `reading=false` + `finished=true` → 次日分配换成另一本在读。
3. 家长面板「在读」按钮点击 → 字段正确切换、UI 高亮。
4. 换书面板候选只列在读书。
5. `pageErrors=[]`，`node --check` 全通过。

---

## 8. 最终确认口径（2026-11-18）

1. **入口在任务卡片**：用户明确要在「每日阅读」任务卡片上直接选正在读的书，而不是去家长面板标记（家长面板开关作为辅助保留）。
2. **去掉默认分配**：不再按书库顺序/轮转默认分配书。书库示例书保留但 `reading=false`，新用户任务卡片初始不显示书，提示去选。
3. **选中一直显示直到读完才换**：选中的书跨天持续显示（读完后才退出）。读完一本 → 自动取消该书 `reading` → 卡片自动切到下一本在读书（若还有）；没有在读书则显示"选书"引导。
4. **每本独立、可多本在读**：允许同时标记多本在读（中文/英文不限），卡片显示全部在读书；完成任一本书的阅读即算当天任务完成（沿用"任一读完即完成"）。
5. **中英各一本的限制取消**：改为完全由用户勾选决定，不再强制一中一英。
