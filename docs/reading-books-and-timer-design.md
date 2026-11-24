# 阅读书目优化 + 全屏计时修复 设计文档

> 状态：**已实现并验证**（2026-11-18）。无头验证 4 场景全部通过；未推送，待用户明确指令。

## 1. 背景与目标

用户反馈三个问题：

1. **阅读打卡完成时弹出的书名，都不是在读的书** —— 希望弹窗只显示"在读"的书。
2. **书库里已录入的书不能修改** —— 希望支持编辑（至少能改书名）。
3. **全屏计时的显示 bug** —— 开始任务时全屏显示计时，点缩小退出、再点 ⛶ 恢复全屏后，计时数字不再实时更新，但后台其实一直在计时。

目标：分别修复/改良，且不影响现有的"每日双书轮转 + 任一读完即完成"机制。

---

## 2. 问题根因分析

### 问题 1：打卡弹窗的书不是"在读的"

- `weekly-plan.js → assignReadingBooksForTask()` 取书池为 `books.filter(b => b.lang === lang)`，**没有排除已读完（finished=true）的书**。
- 结果：书库里已标记读完的书仍会进入轮转，被分配到当天任务；任务卡片与打卡确认弹窗（`showBookFinishedConfirm` 的 `task.books`）就会显示这些"已经读完"的书，出现"弹出的都不是在读的"。
- 另外，`task.books` 里冗余存了 `bookTitle`，书库改名后旧任务里的书名不会同步（问题 2 修好后更需要处理）。

### 问题 2：书库内容不能修改

- `parent-panel.js → renderReadingBooksManagement()` 目前每本书只有「标已读/未读」和「删除 🗑」两个按钮，没有编辑入口。
- 项目里没有通用输入弹窗，只有 `window.showConfirm`（确认框），需要自行实现轻量行内编辑。

### 问题 3：全屏计时退出再进入不实时更新

- 计时显示完全依赖 `setInterval(updateActiveTimer, 1000)` 单一驱动；浏览器在页面隐藏、窗口失焦、全屏状态切换、移动端切后台时会**节流或暂停 setInterval**，导致显示停滞。
- 但底层数据来自 `task.startedAt`（绝对时间戳），差值计算仍正确——这正是"后台在计时、显示不动"的典型表现。
- 次要缺陷：
  - `updateActiveTimer()` 用全局变量 `timerStartTime` 而非 `task.startedAt` 计算，跨会话/重新渲染后可能与真实起点不一致。
  - `closeTimerFullscreen()` 用 `setTimeout(() => el.remove(), 300)` 延迟移除 DOM；若 300ms 内重开，会出现两个 `id="fullscreen-timer-display"` 的重复元素，`getElementById` 可能取到即将被删除的旧节点，导致新弹窗不更新。

---

## 3. 技术方案

### 3.1 只分配/弹出"在读"的书

- `assignReadingBooksForTask()`：取书池改为 `books.filter(b => b.lang === lang && !b.finished)`（只读完的排除）。某语言池无在读书时该语言不分配。
- 轮转指针 `readingRotation[lang]` 仍按新池推进；若当前指针指向的书已读完（不在池中），回退到池首。
- 手动换书 `showBookSwapPanel` 的候选列表同样只列在读书。
- 打卡确认弹窗 `showBookFinishedConfirm`：书名以书库 `readingBooks` 实时为准（用 `bookId` 重新查 `title`），不再用冗余的 `bookTitle`，这样书库改名后立即同步。
- 已完成的历史任务不追溯改写，仅影响新分配与当前弹窗显示。

### 3.2 书库支持编辑

- `renderReadingBooksManagement()` 每本书行增加「编辑 ✏️」按钮（放在标已读/删除之间）。
- 点击后把书名区域切换为行内 `<input>` + 保存/取消：回车或失焦保存，Esc 取消；保存时写回 `readingBooks[].title` 并重渲染。
- 同时提供轻量输入弹窗方案（如需改备注）——默认只做书名编辑，保持简单。
- 编辑后如当天任务的 `bookTitle` 是冗余存储，以 3.1 的实时查询为准，无需回写任务。

### 3.3 全屏计时实时更新

- `updateActiveTimer()` 改为按当前 active 任务的 `task.startedAt` 计算 elapsed（不再依赖 `timerStartTime`），确保任何时刻都基于绝对时间、抗跨会话。
- 增加"强制刷新"触发点：
  - `visibilitychange`（页面重新可见）
  - `window.focus`（窗口重新聚焦）
  - `fullscreenchange`（浏览器全屏状态变化）
  - `pageshow`（bfcache 恢复）
  - 以上事件均调用 `updateActiveTimer()` 立即刷新一次。
- `showTimerFullscreen()` 弹窗创建后立即调用一次 `updateActiveTimer()`，保证初始数字正确。
- `closeTimerFullscreen()` 去掉 300ms 延迟，直接 `el.remove()`，避免重复 id 竞态。

---

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/weekly-plan.js` | `assignReadingBooksForTask()` 只从在读书取；指针回退逻辑；换书候选过滤 |
| `js/task-list.js` | 打卡弹窗书名实时查书库；`updateActiveTimer` 按 startedAt 计算；新增 visibility/focus/fullscreenchange/pageshow 监听；`showTimerFullscreen` 立即刷新；`closeTimerFullscreen` 立即移除 |
| `js/parent-panel.js` | `renderReadingBooksManagement()` 增加行内编辑书名 |
| `css/parent.css` | 书库编辑按钮/输入框样式 |
| `docs/reading-books-and-timer-design.md` | 本文档 |
| `monster-pet/` 对应副本 | 全部同步 |

---

## 5. 实施步骤

1. 先改 `weekly-plan.js` 分配逻辑（含换书候选）。
2. 改 `task-list.js` 打卡弹窗实时书名 + 计时修复。
3. 改 `parent-panel.js` + `css/parent.css` 书库编辑。
4. 全部同步到 `monster-pet/` 子目录，`node --check` 校验语法。
5. Playwright 无头验证（见下）。
6. 交付后**不主动推送**，等用户明确"推送git"。

---

## 6. 防回退

- **分配逻辑**：`!b.finished` 过滤必须在 `filter` 里，不能事后过滤——否则指针推进会错位。
- **计时**：任何新增的计时显示路径都必须基于 `task.startedAt` 绝对时间，禁止回到"累加 interval 计数"的做法。
- **编辑**：`const lang` 必须留在 `forEach` 循环体（click 回调外）——这是上次 `lang is not defined` 的根因，改这个函数时极易再次踩坑。
- 双目录同步：`mission/` 与 `monster-pet/` 都要改，否则部署看不到效果。

---

## 7. 验证计划（Playwright 无头）

1. 把某本在读书标记为已读 → 重新生成当天任务 → 确认分配的书中不再含已读完的书。
2. 书库改名 → 打开打卡确认弹窗 → 显示的是新书名。
3. 编辑书名保存 → 书库列表与任务卡片同步更新。
4. 开始任务 → 全屏计时 → 模拟隐藏/恢复 → 计时数字随真实时间跳变且连续。
5. `pageErrors=[]`，`node --check` 全部通过。

---

## 8. 待你确认的口径

1. **"在读的书"是否就等于书库里未标记读完（finished=false）的书？** 方案按此实现；已读完的书将不再参与每日轮转分配。
2. **书库编辑范围**：先只支持改书名（保持简单），备注字段暂不提供编辑——是否 OK？
3. **"任一读完即完成"是否维持现状**（点完成即完成，弹窗仅记录每本读完状态，不强制必须先读完）？——沿用现状，除非你要求加门槛。
