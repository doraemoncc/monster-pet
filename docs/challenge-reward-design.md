# 挑战任务「实物奖励兑换」设计文档

> 状态：**方案待确认**（2026-11-24）。按用户约定：功能改动先完善方案设计文档、请用户确认后再实施代码。本轮**不改任何业务代码**。
> 触发反馈：「挑战的任务支持兑换实物奖励，增加一个设置实物奖励的功能，可以显示一个兑换实物奖励照片」。
> 前置基础：`challenge-in-daily-tasks-design.md`（v1 接入每日任务页）、`challenge-push-to-daily-design.md`（v2 家长推送机制）、`challenge-daily-progress-design.md`（v3 每日打卡进度）。

## 1. 背景与目标

挑战目前完成后只发 `bonusCoins` 星币，而星币只能买虚拟食物/装饰（`shop.js`）。家长想用真实物品（乐高、去公园、一顿冰淇淋）激励孩子，但：

- 家长面板**没有任何地方**能设置"这个挑战的实物奖励是什么"；
- 孩子端**看不到奖品长什么样**，挑战卡片只有一行「💰 +20」；
- 完成挑战后没有兑换凭证，家长也没有核销入口。

**目标**：家长可为每条挑战设置实物奖励（名称 + 照片 + 备注）→ 孩子在每日任务页看到奖品照片 → 完成挑战后获得兑换资格并展示兑换券大图 → 家长确认已发放（核销）。照片本地存储、离线可用、不依赖后端/付费服务。

## 2. 现状调研

| 项 | 现状 |
|---|---|
| 挑战数据 | `store.challenges`：`{id,title,description,bonusCoins,accepted,completed,completedAt,weeklyReset,isChallenge,pushedToDaily,pushedAt,targetDays,dailyLog}` —— **无奖品/图片/兑换字段** |
| 完成逻辑 | `task-list.js:574 completeChallenge()`：二次确认 → `completed=true` → 发 `bonusCoins` + `grantBonusInteraction('both')` → `renderTaskList()`。**这是唯一发币入口** |
| **关键约束** | `getActiveChallenges()` 过滤 `!completed && pushedToDaily===true`，**挑战完成后卡片立即从任务页消失**。奖品照片若只挂在挑战卡片上，完成后就看不见了 → 必须有独立的「我的奖励兑换」区 |
| 家长面板 | `🏆 挑战` tab → `renderChallengeManagement()`（列表：推送/撤回、编辑、删除、进度明细）+ `openChallengeEditor()`（名称/描述/奖励星币/目标天数） |
| 图片能力 | 项目**没有任何图片上传/压缩机制**：只有 `data-io.js:156` 用 `FileReader` 读 JSON 备份；`pet-renderer.js` 用静态 `images/pets/*.png`；无后端、无 IndexedDB、无云存储 |
| 存储 | `localStorage` 单键 `monster-pet-data` 全量 JSON（`store._data` / `_save()`）；`data-io.js:44 exportJSONBackup()` 把整份 localStorage 导出 → **照片 base64 会进备份文件** |
| 弹窗/工具 | `.overlay` + `.modal tpl-creator-modal`、`window.showConfirm()`、`showToast()`、`escapeHtml()`（`task-list.js:60`，全局） |
| 类名占用 | `.challenge-*` / `.ch-*` 已被挑战与进度占用；`.task-*` 属于普通任务卡，不可混用 → 新增统一用 **`rw-` 前缀** |
| 脚本引用 | `index.html:89-103` 逐个 `<script>` 引入；新增 JS 文件必须两个目录 + 两个 `index.html` 同步，历史踩过漏同步的坑 → **本次不新增 JS 文件** |

## 3. 技术方案

### 3.1 数据模型（新增 3 个字段，向下兼容）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `physicalReward` | `object \| null` | `null` | `{name, photo, note, updatedAt}`。`name` 1–20 字；`photo` 为压缩后的 dataURL 或 http(s) URL；`note` ≤40 字 |
| `redeemStatus` | string | `'none'` | `'none'` 无资格 / `'pending'` 待兑换 / `'redeemed'` 已兑换 |
| `redeemedAt` | `string \| null` | `null` | 家长核销时间 ISO |

派生值（实时算，不落库）：
- `hasReward = !!(physicalReward && physicalReward.name)`
- `canRedeem = hasReward && redeemStatus === 'pending'`
- 展示用的照片：`photo` 通过白名单校验才渲染，否则显示 🎁 占位块

`store._migrate()` 给老挑战补 `physicalReward:null` / `redeemStatus:'none'` / `redeemedAt:null`。**绝不根据 `completed` 反推兑换状态**（老数据无从考证，已完成的老挑战保持 `none`，不显示兑换券）。`openChallengeEditor()` 新建挑战时显式写入 3 个字段。

### 3.2 家长端：设置实物奖励（🏆 挑战 tab）

`renderChallengeManagement()` 每条挑战新增：

- meta 区：奖励缩略图（有照片时）+ `🎁 奖励名` + 状态徽章（`未设置` / `待兑换` / `已兑换`）；
- 操作区新增「🎁 奖励」按钮 → `openRewardEditor(idx)`；`pending` 时额外显示「✅ 确认已兑换」按钮 → `redeemChallengeReward(idx)`；`redeemed` 时显示「↩️ 撤销核销」（防家长误点）。

`openRewardEditor(idx)` 独立弹窗（**不套在挑战编辑弹窗里**，避免弹窗嵌套与事件混乱）：

```
┌─ 🎁 设置实物奖励 ─────────────── ✕ ┐
│  [  照片预览 480×?  ]  [📷 上传照片] │
│        点「上传」可从相册选或拍照     │
│  或粘贴图片网址：[_______________]  │
│  奖励名称：[ 乐高小套装        ]    │
│  备注（可选）：[ 周末一起去买   ]    │
│      [ 🗑️ 清除奖励 ]   [ 保存 ]      │
└────────────────────────────────────┘
```

- 上传：`<input type="file" accept="image/*" capture="environment">`（移动端可直接拍照，桌面端选相册）；`rwCompressImage(file)` 做压缩：
  1. 校验 `file.type.startsWith('image/')`、原图 ≤ 10MB；
  2. `FileReader → Image → canvas`，最长边压到 **480px**、白底填充、`canvas.toDataURL('image/jpeg', 0.72)`；
  3. 若结果 > 180KB，再降到 360px / 0.6；仍超则拒绝并 `showToast('照片太大，请换一张')`；
  4. 全程 try/catch，失败不写入 store。
- URL 备选：填 `https://...` 或 `data:image/...;base64,...` 也接受（离线优先下默认用上传）。
- 保存时 `name` 必填；`photo` 为空也允许（只显示 🎁 占位 + 名称）。
- 「清除奖励」把 `physicalReward=null`；若该挑战已 `pending/redeemed`，二次确认后一并清 `redeemStatus='none'`（避免留下无奖品的孤儿兑换券）。

### 3.3 孩子端：照片展示与兑换券

**① 挑战卡片新增奖品块**（`renderChallengeSection()` 内，位于描述与进度之间）：

```
┌──────────────────────────────────┐
│ 🎁 实物奖励                       │
│ ┌────┐  乐高小套装                │
│ │照片│  🔒 完成挑战后解锁兑换      │
│ └────┘                           │
└──────────────────────────────────┘
```

- 缩略图 `loading="lazy"`，点击（或点整块）→ `showRewardPhoto()` 大图弹窗：`.overlay` 居中、照片大图 + 名称 + 备注 + 「关闭」，点遮罩关闭；
- 状态文案：未接受/进行中显示「🔒 完成挑战后解锁兑换」；不显示任何可点兑换按钮（避免绕过完成逻辑）；
- **未设置奖励的挑战完全不渲染这块**，卡片布局与现在一致。

**② 完成后独立的「🎁 我的奖励兑换」区**（关键）：

`getActiveChallenges()` 会把已完成挑战过滤掉，所以在挑战区**下方**新增一块，遍历 `challenges` 中 `redeemStatus !== 'none'` 的记录（含 `completed` 的和撤回推送的），按 `pending` 优先排序：

```
┌─ 🎁 我的奖励兑换 (2) ─────────────┐
│ ┌──────┐  乐高小套装               │
│ │ 大图 │  🎉 待兑换 · 完成于 11/24 │
│ └──────┘  [ 查看兑换券 ]           │
│ ┌──────┐  冰淇淋                  │
│ │ 大图 │  ✅ 已兑换 · 11/20       │
│ └──────┘                          │
└───────────────────────────────────┘
```

「查看兑换券」→ `showRewardClaimPopup(ch)`：照片大图 + 「🏆 挑战：xxx」+「完成于 yyyy-mm-dd」+「把这个给爸爸妈妈看，兑换实物奖励吧 🎁」+「知道啦」。已兑换的显示「✅ 已兑换」灰态。

**③ `completeChallenge()` 衔接**：二次确认通过后、发币逻辑**完全不动**，追加：

```js
if (hasReward) {
  ch.redeemStatus = 'pending';
  // 与 completed 一起写入同一次 store.set('challenges')
  // 渲染后弹 showRewardClaimPopup(ch)，toast 改为提示获得兑换资格
}
```

无奖品的挑战：行为、toast 与现在完全一致（不改变老用户体验）。

### 3.4 兑换状态机

```
none ──完成挑战(有奖品)──> pending ──家长「确认已兑换」──> redeemed
  │                              └────── 家长「撤销核销」 ──┘
  └──完成挑战(无奖品)──> none（保持现状，不进兑换区）
```

- 只有 `pending` / `redeemed` 进「我的奖励兑换」区；`none` 不显示；
- 家长删除挑战时 `splice` 会一并删掉兑换记录 → 删除确认文案补一句「其实物奖励兑换记录也会删除」；
- 撤回推送（`pushedToDaily=false`）**不清兑换状态**：已经挣到的资格不因撤回消失。

### 3.5 明确不动的东西（防回退）

- `bonusCoins` 数值、星币发放、`grantBonusInteraction('both')`、`updateCoinDisplay()` —— 全部不动；实物奖励**不消耗星币**；
- `completeChallenge()` 的二次确认与唯一发币入口地位不动，只在其后追加状态写入；
- `pushedToDaily` 推送/撤回机制、`getActiveChallenges()` 的严格 `=== true` 筛选不动；
- `dailyLog` / `targetDays` 每日打卡进度、达标只提示不自动完成（v3 用户选 B 口径）不动；
- 挑战仍**不写入 `tasks`**，不参与 `isTodayAllDone()` / 门卫解锁 / 日期圆点；
- `shop.js`（虚拟商城）、`data-io.js`（备份逻辑）、`sw.js`、`index.html` 脚本清单不动；
- 死面板 `showChallenges()` 不动（无调用点）。

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/store.js` | `_migrate()` 给 challenges 补 3 个字段（不反推状态）；新建挑战默认值在 `parent-panel.js` 中一并写 |
| `js/parent-panel.js` | `rwCompressImage()`、`openRewardEditor()`、`redeemChallengeReward()`；列表缩略图/徽章/按钮；删除确认文案；事件绑定 |
| `js/task-list.js` | `rwSafePhoto()` 白名单校验、`showRewardPhoto()`、`showRewardClaimPopup()`、`renderRewardClaimSection()`；挑战卡片奖品块；`completeChallenge()` 追加状态；新增按钮事件绑定 |
| `css/parent.css` | `.rw-editor-*`（上传区/预览/表单）、列表缩略图与徽章 |
| `css/task.css` | `.rw-card` / `.rw-photo` / `.rw-badge` / `.rw-claim-section` / `.rw-claim-item` / `.rw-overlay` 大图弹窗；窄屏适配 |
| `docs/challenge-reward-design.md` | 本文档 |
| `monster-pet/` 子目录 | 同步上述 js / css / docs |

**不新增 JS/CSS 文件**（避免 `index.html` 在两个目录漏同步，历史踩坑）。

## 5. 实施步骤

1. 确认第 8 节口径（**本轮停在这里，等用户回复**）。
2. `store.js` 迁移补 3 字段；`parent-panel.js` 新建挑战时写入默认值。
3. `parent-panel.js`：压缩函数 → 奖励编辑弹窗 → 列表徽章/按钮 → 核销/撤销 → 事件。
4. `task-list.js`：照片白名单 → 卡片奖品块 → 兑换区 → 完成逻辑衔接 → 大图/兑换券弹窗 → 事件。
5. 两处 CSS（新增 `rw-` 前缀样式，不改既有 `.challenge-*` / `.ch-*`）。
6. 同步 `monster-pet/` 的 js / css / docs；`node --check` 全部改动 JS。
7. Playwright 无头验证（第 7 节）+ 空 localStorage 首开验证。
8. 发本地预览链接（`preview-server.py` no-store）并说明对应版本；**不推送**，等用户明确说「推送git」。

## 6. 防回退

- **照片值必须白名单校验**：只接受 `data:image/jpeg;base64,` / `data:image/png;base64,` / `data:image/webp;base64,` / `http(s)://` 开头；写进 `src` 前再用 `escapeHtml()` 包一层，杜绝 `javascript:` 与引号闭合注入（`rwSafePhoto()` 统一出口）。
- **绝不把原图 base64 写进 localStorage**：必须压缩后再存（localStorage 约 5MB 上限，一张手机原图 3–5MB 会直接把整个应用写爆）。压缩失败要 try/catch + toast，不能留半成品数据。
- `photo` 为空 / 加载失败 → `<img>` 的 `onerror` 降级为 🎁 占位块，**不能渲染 `<img src="">`**（否则会请求当前页、出现破图循环）。
- 完成后卡片消失是本需求**最容易漏的一点**：必须有独立「我的奖励兑换」区，否则"兑换实物奖励照片"在完成那一刻就没了。
- 奖励状态与 `completed` 写在**同一次** `window.store.set('challenges', list)` 里；不要新增第二个写 challenges 的函数在完成后再写一次，避免覆盖发币后的数据。
- 迁移默认值 `redeemStatus:'none'`，**绝不根据 `completed` 反推 `pending`/`redeemed`**（与 v3「不反推历史打卡」同一原则）。
- 撤回推送不清兑换状态；删除挑战才清（连带删除，需在确认文案中告知）。
- 函数名 / 类名统一 `rw-` / `rw*` 独特前缀；`const` 不在同一作用域重复声明（书库增删失效的教训：一个 `ReferenceError` 会让整页静默失败）。
- 改完必须 `node --check js/store.js js/parent-panel.js js/task-list.js`；对照 `docs/monster-pet-design.md` 第十一章检查清单；**空 localStorage 首次打开**验证 `_migrate()` 首次分支也生效。
- 预览必须用 `python3 preview-server.py 8099`（no-store），本地不注册 SW；否则又会出现"改完看不到新版"。
- 备份 JSON 会包含照片（每张压缩后约 40–120KB），属可接受，**本次不改 `data-io.js`**；若日后奖品图片变多再考虑导出时剥离。

## 7. 验证方案（Playwright 无头）

1. **老数据兼容**：预置无新字段的旧挑战（含已完成的）→ 加载后 `physicalReward=null, redeemStatus='none', redeemedAt=null`；已完成的旧挑战不出现兑换券。
2. **设置奖励**：家长面板点「🎁 奖励」→ 填名称 + 上传测试图 → 保存后 `physicalReward.name` 正确、`photo` 以 `data:image/jpeg;base64,` 开头且 < 180KB；列表出现缩略图。
3. **照片可见**：推送挑战后，孩子端卡片出现奖品块 + 缩略图；点缩略图弹出大图。
4. **无奖品不改变布局**：未设置奖励的挑战卡片不出现 `.rw-card`。
5. **完成得资格**：点「完成 ✓」→ 二次确认 → 星币 +20 照发、`redeemStatus='pending'`、弹兑换券大图、卡片从挑战列表消失但**兑换区出现该奖品**。
6. **家长核销**：点「✅ 确认已兑换」→ `redeemStatus='redeemed'`、`redeemedAt` 有值；孩子端兑换区变灰「✅ 已兑换」；「↩️ 撤销核销」可回 `pending`。
7. **撤回推送**：撤回后兑换券仍在（`pending`/`redeemed` 不清）。
8. **清除奖励**：清奖励后卡片奖品块消失；已 `pending` 的兑换券同步移除（有二次确认）。
9. **安全**：注入 `javascript:alert(1)` / 带引号的假 URL → `rwSafePhoto()` 返回空，渲染 🎁 占位，无脚本执行；`pageErrors=[]`。
10. **边界**：分类筛选、`isTodayAllDone()`、门卫解锁不受影响；根目录与 `monster-pet/` 文件一致；`node --check` 通过；`getRegistrations().length===0`（本地不注册 SW）。

## 8. 待确认口径（只问一个问题）

**实物奖励怎么「兑换」？**

- **A. 每条挑战绑定一个奖品，完成挑战 = 获得兑换资格，家长确认核销（推荐）**：改动最小、完全不动星币体系；家长在挑战库里点「✅ 确认已兑换」完成闭环，孩子端有兑换券照片。
- **B. 同 A，但完成即得、不需要家长核销**：省一步，少一个状态；兑换券只做展示，不记录发放。
- **C. 独立「实物奖励库」+ 星币兑换**：家长建多个奖品并设所需星币，孩子像商城一样用星币兑换，与具体挑战解耦。改动最大，要动 `shop.js` / 商城页 / 星币扣减，且与"挑战的任务支持兑换"的语义偏离较远。

若选 A（或 B），以下为**默认口径**，不同意请一并说明：

- 照片走**本地上传 + 自动压缩**（可选填图片 URL），纯离线、免费、不依赖后端；
- 实物奖励**不消耗星币**，完成挑战照常发 `bonusCoins`；一条挑战绑一个奖品；
- 家长可为每条挑战设置/修改/清除奖励；已完成挑战的奖励只读（不再改设置，但可核销/撤销）；
- 备份 JSON 会包含照片数据。

回复「按 A 来」或说明调整，确认后我开工。
