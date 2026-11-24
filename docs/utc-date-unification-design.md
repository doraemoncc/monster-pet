# UTC 日期口径全量统一 —— 方案 / 对抗审查记录

> 状态：**方案已自行对抗审查通过并实施（2026-11-24）**。用户明确「方案不看了，自己对抗审查，改完做好代码审查，直接推送」，因此本文不用于等待确认，而是作为实施口径、反例清单、代码审查与防回退的留痕。
> 上一版 `docs/date-nav-timezone-fix-design.md` 只修了展示层两处，本文覆盖其余全部链路。

## 1. 背景与问题定义

`completedAt` / `createdAt` / `startedAt` 等**时间戳**用 UTC ISO（`new Date().toISOString()`）是正确的，不应修改。
但项目多处把 `new Date().toISOString().slice(0, 10)` 或 `iso.startsWith(key)` 当作**「今天的日期键」**使用。在 GMT+8，本地 00:00–08:00 时 UTC 仍是前一天，于是：

- 今天早上 7:30 生成的任务被写成昨天的 `lastResetDate`；
- 今天早上 7:30 完成的记录被归档到昨天（圆点、统计、CSV、家长面板"今日完成"）；
- 跨天重置、门卫解锁、喂食次数、连击、周计划覆盖 key 全部按"UTC 天"边界切换，与用户认知的"一天"错位；
- **最危险**：升级修复口径时，旧数据里的 UTC 日期键与新口径的本地日期键不相等，可能触发一次性误重置 / `reconcileTodayTasks()` 判定"今天没有任务"而**重复生成一整批任务**（历史踩过任务重复 bug）。

## 2. 全量扫描结论（逐文件分类）

| 文件 | 位置（改前） | 用途 | 处置 |
|---|---|---|---|
| `app.js` | 112、115 | 门卫进度：今日任务筛选 | 改本地键 + `localDateKeyOfISO(createdAt)` |
| `store.js` | 627/643 | 连击 `lastActiveDate` | 改本地键 |
| `store.js` | 708/712/728 | `resetRepeatTasks()` 跨天重置 | 改本地键 **+ completedAt 守卫** |
| `store.js` | 744/748 | 提醒清空日期 | 改本地键 |
| `store.js` | 755/759 | `isTodayAllDone()` | 改本地键 + ISO→本地 |
| `store.js` | 768/777/786 | 门卫解锁记录 / 30 天清理 cutoff | 改本地键 |
| `store.js` | 812/819 | 每日互动次数 key | 改本地键 |
| `store.js` | 855–861 | `_getWeekKey()` 本周一（UTC 输出） | 改本地键构造 |
| `store.js` | 924 | `setWeekOverride` 默认 expiry | 改本地键，**顺带修既有 bug**（注释写本周末、实际给本周一） |
| `weekly-plan.js` | 80、134、165、193 | 今日计划对账 / 过期 / 生成 / 去重 | 4 处改本地键 |
| `parent-panel.js` | 112–113 | 首页"今日完成"统计 | ISO→本地 |
| `parent-panel.js` | 298/319 | 手工新增任务 `lastResetDate` | 改本地键 |
| `parent-panel.js` | 501 | 进度弹窗内联 `localKey` | 删除内联，统一调用 |
| `parent-panel.js` | 1729 | 本周安排默认过期日 | 改本地键 |
| `task-list.js` | 40–43 | `dateKey()` | 保留函数签名，委托统一工具 |
| `task-list.js` | 502 | 历史日期视图 `createdAt.startsWith(selKey)` | ISO→本地 |
| `stats-io.js` | 20–27、54–58 | `getDateStr` / `localDateStr` / `toLocalDate` | 删除重复实现，委托统一工具 |
| `data-io.js` | 19、81、98、122、206 | 遗留导出模块 | 一并修（见 §3 纠错） |
| `stats-io.js` | 77 `getRangeStart()` | 与 UTC ISO 时间戳比较 | **保持不动**（见 §5 反例 8） |
| `store.js` | 335–341 早鸟 | `getHours()` 已是本地 | **保持不动** |

### 扫描中推翻的两个上轮结论（对抗审查发现）

1. **`data-io.js` 是死文件**：`index.html` / `monster-pet/index.html` 都**只加载 `stats-io.js`**，没有任何 `<script>` 或动态注入引用 `data-io.js`（`docs/data-io-design.md` §4.2 明确写「`data-io.js` → 重构为 `stats-io.js`」）。上轮文档写的「`data-io.js` 导出的任务明细 CSV 日期列早 8 点前差一天」是**误判**：实际生效的 CSV 导出在 `stats-io.js`，上一轮已改为本地归档。本次仍顺手修 `data-io.js`，目的是防止未来误加载复活 bug，并消除它与 `stats-io.js` 的全局同名 `const CATEGORY_NAMES` / `getDateStr` / `formatDuration` / `triggerDownload` 冲突隐患。
2. **上轮"10+ 处 UTC 写法属于任务生成核心链路、不能动"的顾虑是对的，但缺了关键防护**：只把 `slice(0,10)` 换成 `localDateKey()` 会立刻制造误重置与任务重复。必须同时做「一次性数据迁移」+「基于时间戳的重置守卫」，二者缺一不可（§4）。

## 3. 技术方案

### 3.1 单一事实来源（不新增 JS 文件）

统一工具放在 **`js/app.js` 顶部**（`index.html` 第一个脚本，且 `store.js` 末尾 `new Store().init()` 会立即执行 `_migrate()`，工具必须此时已存在）。不新增文件 → 不用改两个 `index.html`，也不用往 `sw.js` 预缓存清单加条目。

- `localDateKey(d)` → 本地 `YYYY-MM-DD`；**纯日期字符串直接原样返回**（避免 `new Date('2026-11-24')` 按 UTC 午夜解析，在负时区会退一天）。
- `localDateKeyOfISO(iso)` → UTC ISO 时间戳 → 本地日期键；非法日期返回 `''`。
- `localWeekKey(d)` → 本周一本地日期键（用本地年月日构造 `new Date(y,m,d+diff)`，规避 DST 偏移）。
- `localWeekSundayKey(d)` → 本周日本地日期键（修 `setWeekOverride` 默认过期日）。
- `utcDateKey(d)` → **仅**用于识别旧数据，业务代码禁止调用。
- `isLocalTodayISO(iso)` → 便捷判断。

同时收敛既有重复实现：`task-list.js:dateKey()`、`stats-io.js:toLocalDate()` 保留签名但委托统一工具；删除 `stats-io.js:getDateStr()/localDateStr()`、`data-io.js:getDateStr()`、`parent-panel.js:localKey` 四处重复定义（消除全局同名函数互相覆盖的隐患）。

### 3.2 一次性数据迁移 `dateSchema`

`DEFAULT_DATA` 新增 `dateSchema: 'local'`；`_migrate()` **开头**调用 `_migrateDateSchema()`，旧数据（无标记）执行一次：

1. `localToday = localDateKey(now)`，`utcToday = utcDateKey(now)`（旧口径的"今天"）。
2. 任务 `lastResetDate`：把等于 `utcToday` 的值升级为 `localToday`，**但排除「`status==='completed'` 且 `completedAt` 的本地日期不是今天」**的任务——它们确实是昨天完成的，必须保留旧值让跨天重置正常触发。
3. `_lastDailyGen` / `user.lastActiveDate` / `_lastReminderClear`：同样归一化。
4. `dailyUnlock[utcToday]`、`dailyInteractions[utcToday]`：迁移到 `localToday`（若目标不存在），**保持升级当天已解锁状态与已用喂食次数**，避免孩子已完成全部任务却被门卫拦下、或重复获得喂食机会；旧 key 删除。
5. `weekOverrides[旧 _getWeekKey() 结果]`：迁移到 `localWeekKey()`（若目标不存在），避免周一早 8 点前创建的本周覆盖在升级瞬间失效。
6. 写入 `dateSchema = 'local'` 并 `_save()`；之后永不重跑。用 `this._data` 直接改 + `_save()`，**不用 `this.set()`**，避免 store 初始化阶段触发 `data:changed` 事件。

> 说明：纯日期字符串无法从字面区分"UTC 口径"与"本地口径"，歧义只存在于 **升级瞬间恰逢本地 00:00–08:00**。策略是「用时间戳精确排除昨天完成的任务，其余保守归一化」，等价于**保持旧代码在该时段原本的行为**，且从第二天起全部按本地口径运行。这是唯一不需要猜测、也不会破坏数据的做法。

### 3.3 与迁移无关的两道硬守卫（防回退核心）

1. **`resetRepeatTasks()` 增加 `completedAt` 守卫**：若任务 `completedAt` 的本地日期 == 今天，直接 `return`，绝不重置。此守卫不依赖任何日期字段口径，可同时防住口径切换、早 8 点边界、以及未来任何 `lastResetDate` 异常。
2. **`reconcileTodayTasks()` 的"今天已有任务"计数同时接受 `createdAt` 本地日期**：即使迁移漏掉某条老任务，也不会误判"今天 0 条"而重新生成一批。

### 3.3b 启动顺序修复（对抗审查实证发现，现役 bug）

**实测**：构造「两天未打开 App」的老数据（任务昨天以前创建并完成、`_lastDailyGen` 为前天），加载页面后任务由 4 条变 **8 条**，每个模板两份、全部 `pending`。

根因：`weekly-plan.js` 的 `DOMContentLoaded` 监听先注册（脚本顺序在 `reminder.js` 之前），`checkDailyPlanGeneration()` 先跑 `reconcileTodayTasks()` —— 此时老任务 `lastResetDate` 还是前天，Step 2 计数为 0，于是按周计划新建一整批；随后 `reminder.js` 才调 `resetRepeatTasks()` 把老任务重置成 `pending` 且 `lastResetDate=今天`。两批并存即重复。**这不是本次 UTC 改动引入的，旧代码同样会触发**，但属于同一条任务生成链路，且本次改动了这两个函数的日期口径，必须一并根治。

修复：`weekly-plan.js` 的 `DOMContentLoaded` 里先调一次 `window.store.resetRepeatTasks()`（幂等），再 `checkDailyPlanGeneration()`。重置后的老任务 `lastResetDate=今天`，Step 2 正确计入，不再新建；`reminder.js` 后续再调一次直接 `return`。修复后同一诊断场景回到 4 条、无重复。

> 不在 `reconcileTodayTasks()` 内部调重置：家长编辑周计划删模板时，重置会把「已完成」变成 `pending`，进而被 Step 1 当作「计划中已删除的 pending」误删。

### 3.4 明确不动

- 所有 `new Date().toISOString()` **时间戳**写入（`completedAt` / `createdAt` / `startedAt` / `timestamp` / `pushedAt` / `redeemedAt` / `exportDate`）——UTC ISO 是正确的时间点表示。
- `stats-io.js:getRangeStart()`：`now.toISOString()` 与同为 UTC ISO 的 `completedAt` 比较，量纲一致，改成日期键反而会错。
- 早鸟判断 `getHours()` / `getMinutes()`：本来就是本地时间。
- `task-creator.js` 的 `deadline`（用户输入的绝对时间点）、`reminder.js` 的 `Date.now()` 比较。
- `sw.js` 的缓存策略仅 bump 版本号 `v2 → v3`，让线上老客户端强制刷新预缓存；本地仍按既有约定不注册 SW。

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/app.js` | 顶部统一日期工具（6 个函数，挂 `window`）；`showShopGuard()` 今日任务筛选 |
| `js/store.js` | `DEFAULT_DATA.dateSchema`；`_migrateDateSchema()`；10+ 处日期键；`resetRepeatTasks` 守卫；`_getWeekKey`；`setWeekOverride` 默认 expiry |
| `js/weekly-plan.js` | 4 处 `todayStr`；`reconcileTodayTasks` 计数兼容 |
| `js/parent-panel.js` | 首页统计 / 新增任务 / 默认过期日 / 进度弹窗内联函数 |
| `js/task-list.js` | `dateKey()` 委托；历史视图 `createdAt` 比较 |
| `js/stats-io.js` | 删除重复日期实现，委托统一工具；`getRangeStart` 加注释 |
| `js/data-io.js` | 遗留模块同步修日期 + deprecated 注释（消除全局同名冲突） |
| `sw.js` | `CACHE_NAME` v2 → v3 |
| `docs/utc-date-unification-design.md` | 本文 |
| `monster-pet/` | 上述全部文件逐字节同步 |

## 5. 对抗审查：主动构造的反例

| # | 反例 | 旧行为 / 风险 | 本方案 |
|---|---|---|---|
| 1 | GMT+8 本地 07:30 完成任务，UTC 是前一天 23:30 | 圆点、统计、CSV、家长面板算昨天 | 全部 `localDateKeyOfISO` |
| 2 | **升级瞬间恰在 07:30，今天任务已完成** | `lastResetDate` 旧 UTC 值 ≠ 新本地 today → 任务被重置回 pending，可再刷一次星币 | 迁移归一化 + `completedAt` 守卫双保险 |
| 3 | **升级瞬间 07:30，reconcile 判"今天没有计划任务"** | 按周计划重新生成一整批 → 任务重复 | 迁移归一化（pending/active 任务）+ 计数接受 `createdAt` 本地日期 |
| 4 | 昨天 20:00 完成，今天 07:30 升级 | 与 #2 的 `lastResetDate` 字符串完全相同，粗暴归一化会让今天**没有任务** | 用 `completedAt` 时间戳精确排除，保留旧值让跨天重置生效 |
| 5 | 老数据 `dailyUnlock[昨]` 在今天早上 | 口径切换后读不到 → 已完成全部任务却进不了商城 | 按 `utcToday` 迁移到 `localToday` |
| 6 | 周一 07:30 建的本周覆盖 | 旧 `_getWeekKey()` 返回上周日 → 覆盖失效；升级后按本地周一更查不到 | 旧 key → 新 `localWeekKey()` 迁移 |
| 7 | `setWeekOverride` 不传 expiry | 注释写"本周末"却给本周一，周二即过期 | 改为 `localWeekSundayKey()` |
| 8 | `getRangeStart('7d')` | 若误改成日期键比较会漏掉当天记录 | 明确不动，保留 UTC 时间戳比较 |
| 9 | 负时区 / DST，`new Date('2026-11-24')` | 按 UTC 午夜解析成前一天 | `localDateKey` 对纯日期字符串原样返回 |
| 10 | 12/31 → 1/1、跨月 | 字符串比较 / 手工拼接易错 | 统一 `Date` 对象本地取值，`getMonth()+1` |
| 11 | `data-io.js` 未来被误加载 | 与 `stats-io.js` 顶层 `const CATEGORY_NAMES` 重复声明 → 整页静默失败 | 删除重复 `const` 与全局同名函数，deprecated 注释 |
| 12 | 新用户空 localStorage | 迁移可能误写默认数据 | `DEFAULT_DATA` 自带 `dateSchema:'local'`，迁移直接跳过 |
| 13 | **两天未打开 App**（实证） | 周计划先生成、后重置 → 4 条任务变 8 条，每模板两份 | §3.3b 调整启动顺序；修复后实测回到 4 条 |

## 6. 验证矩阵（Playwright，无头 Chrome）

1. 空 localStorage 首开：任务正常生成、`dateSchema==='local'`、无 SW、无页面报错。
2. 模拟本地 07:30（固定时钟）完成任务：圆点 / 统计聚合 / CSV 文本 / 家长面板"今日完成" / 打卡流水 / 导出文件名全归本地今天。
3. **老数据升级**：手工塞入 UTC 口径 `lastResetDate` / `_lastDailyGen` / `lastActiveDate` / `dailyUnlock` / `dailyInteractions` / `weekOverrides`，在 07:30 打开 → 今天已完成的任务不重置、计划任务不重复、解锁状态保留、连击不误加。
4. **昨天完成 + 今早升级**：`completedAt` 为昨天 → 正常跨天重置，今天有待办任务。
5. 正常时段（14:00）升级：数据不变、任务数不变。
6. 周计划：覆盖 key、默认 expiry 为周日、模板过期比较、编辑周计划后立即同步且不重复；**含「两天未打开」重复回归检查**（任务数不翻倍）。
7. 跨月/跨年：日期键、`localWeekKey` 正确。
8. 负时区（Playwright `timezoneId: America/Los_Angeles`）：纯日期字符串不被回退一天。
9. 回归：挑战推送/完成、实物奖励兑换券、打卡流水弹窗、日期条历史只读、分类筛选、门卫解锁均不受影响；`pageErrors === []`。
10. 部署一致性：根目录 vs `monster-pet/` 逐字节；两处 `node --check`；全仓搜索残留 `toISOString().slice(0,10)` 只允许出现在 `utcDateKey()` 与迁移代码。

## 7. 防回退清单

- **禁止**再把 `new Date().toISOString().slice(0, 10)` / `iso.startsWith(dateKey)` 用作"今天"判断；只有识别旧数据的 `utcDateKey()` 例外。
- **禁止**删除 `resetRepeatTasks()` 里的 `completedAt` 守卫——它是口径切换与任务重复 bug 的最后一道防线。
- **禁止**在别的文件重新定义 `getDateStr` / `localDateStr` / `dateKey` 的独立实现；一律委托 `app.js` 的统一工具（历史上已有 5 份实现，其中 `data-io.js` 与 `stats-io.js` 全局同名会互相覆盖）。
- **禁止**把 `getRangeStart()` 改成日期键比较；它与 UTC 时间戳配套。
- 新增任何"按天"字段时，必须同时考虑：写入用 `localDateKey()`、旧数据迁移、`completedAt` 守卫是否覆盖。
- 改完必须同步 `monster-pet/` 并 `node --check`，本地预览用 `preview-server.py 8099`（no-store），线上推送后 bump `sw.js` 的 `CACHE_NAME`。

## 8. 实施与代码审查记录

- **逐行 diff 审查**：`git diff` 全量核对 8 个业务文件；确认所有 `toISOString().slice(0,10)` 只剩 `utcDateKey()`（仅识别旧数据）与迁移里重算旧 week key 两处；注释里的历史说明不计。
- **命名冲突审查**：全仓 `getDateStr` / `localDateStr` / `localKey` 调用清零；顶层 `const CATEGORY_NAMES` 现在只有 `stats-io.js` 一份（`data-io.js` 改名 `DATA_IO_CATEGORY_NAMES`），排除两模块同时加载时整页静默失败。
- **语法审查**：`node --check` 全量 `js/*.js` 通过；两处部署目录同步后另查一遍。
- **对抗审查实证**：发现并修复「两天未打开 → 任务重复」现役 bug（§3.3b），修复前后各跑一次同一诊断脚本（8 条 → 4 条）。
- **审查中确认无需改动**：`getRangeStart()` 的 UTC 时间戳比较、早鸟 `getHours()`、所有 `toISOString()` 时间戳写入。
- **审查中推翻的上轮结论**：`data-io.js` 是未被加载的死文件，上轮文档所称「CSV 日期列残留」实为误判（实际生效的 `stats-io.js` 上轮已修）；本次仍修它以防复活与全局冲突。
- **验证结果**：Playwright 无头 Chrome 固定时钟 + 多时区，**28/28 全通过**，累计 `pageErrors=[]`。覆盖空首开、早 7:30 全链路归档、老数据升级（今天完成不重置/不重复/解锁与喂食次数与连击保留）、昨天完成今早升级（正常跨天重置）、正常时段升级、两天未打开不重复、周一 week key 迁移与默认过期日、两次 reconcile 数量稳定、跨月跨年、America/Los_Angeles 负时区、既有功能回归。
- **断言勘误**（审查记录）：首轮 26/28 的两处 FAIL 均为验证脚本期望写错 —— ① seed 把 4 条任务全设为今天完成，家长面板「今日完成」应为 4 而非 1；② 周一计划比 seed（周二生成）多 2 个模板，首次 reconcile 补齐属正确行为，改为校验「第二次不新增且模板计数等于当日有效计划」。
- 提交号见工作日志与最终回复。
