# 数据中心模块 —— 完整设计文档

> 版本：v3.0  
> 日期：2026-04-25  
> 状态：待确认  

---

## 一、背景与目标

### 1.1 现状

monster-pet 是纯前端 SPA，所有数据存储在浏览器 `localStorage` 中。这意味着：

- 浏览器清缓存 → **所有数据丢失**
- 换设备/换浏览器 → **数据无法迁移**
- 家长想分析孩子的任务完成情况 → **没有导出手段**

### 1.2 目标

1. **数据可视化**：家长面板新增「统计」Tab，直接看近期数据趋势
2. **数据导出**：支持 JSON 备份 + CSV 报表导出，导出前可预览
3. **长期可追溯**：记录保留时间足够长（年级别），支持回溯分析
4. **内存安全**：不占用过多浏览器存储，数据量可控

### 1.3 用户画像

**豆豆龙（家长）** 想知道：
- 孩子每天完成了几个任务？花了多长时间？
- 每天几点开始做任务？几点做完？
- 和宠物互动了几次？花了多少星币？
- 整体趋势如何？有没有进步？

---

## 二、数据模型设计

### 2.1 数据存储位置

所有数据存在 `localStorage` 的一个 key 下：`monster-pet-data`，值为 JSON 字符串。

### 2.2 完整数据结构（改后）

```
monster-pet-data = {
  // ===== 用户基础 =====
  user: {
    name: '小探险家',
    coins: 50,                    // 当前星币余额
    streak: 0,                    // 连续打卡天数
    lastActiveDate: '2026-04-25'  // 最后活跃日期
  },

  // ===== 宠物数据 =====
  pets: [{
    id, name, type, stage, exp,
    hunger, mood, energy, sick,
    active, accessories, masterLevel,
    createdAt
  }],

  // ===== 任务数据（当天/当周有效，会被重置）=====
  tasks: [{...}],
  weeklyPlan: {...},
  earlyBirdConfig: {...},
  challenges: [{...}],
  remindedTasks: [],
  
  // ===== 用户自定义 =====
  myTemplates: [],
  shopItems: [],

  // ===== 配置 =====
  parentPassword: '0000',
  onboardingDone: false,
  settings: { decaySpeed, aiApiKey },

  // ===== 🆕 历史记录（长期保留，不设上限）=====
  
  completedHistory: [
    // 每次完成任务时写入一条，按时间倒序
    {
      taskId: 'task_xxx',
      title: '语文作业',           // 任务名称
      category: 'school',          // 🆕 任务分类 key
      coins: 8,                    // 获得星币（含所有加成后的总额）
      exp: 10,                     // 🆕 获得经验值
      duration: 200,               // 用时（秒），null 表示未计时
      startedAt: '2026-04-25T06:35:00.000Z',   // 🆕 任务开始时间
      completedAt: '2026-04-25T06:38:20.000Z', // 完成时间
      isEarlyBird: true,           // 是否早鸟奖励
      bonusDetail: [               // 🆕 加成明细
        { icon: '🔥', label: '连击', value: 3 },
        { icon: '🌅', label: '早鸟', value: 3 }
      ]
    }
    // ... 不设条数上限
  ],

  interactionHistory: [           // 🆕 宠物互动历史
    {
      type: 'feed',                // 'feed' | 'play'
      name: '梦幻蛋糕',            // 食物名称 / 玩耍动作名称
      cost: 15,                    // 消耗星币
      timestamp: '2026-04-25T18:30:00.000Z'
    }
    // ... 不设条数上限
  ],

  // ===== 每日状态（短期，保留 30 天）=====
  dailyUnlock: { '2026-04-25': { shopUnlocked, petUnlocked } },
  dailyInteractions: { '2026-04-25': { fed: 1, fedMax: 1, played: 1, playedMax: 1 } }
}
```

### 2.3 与现有结构的差异

| 变更项 | 现在 | 改后 | 原因 |
|--------|------|------|------|
| `completedHistory` 上限 | 100 条 | **不设限** | 支持长期数据分析 |
| `completedHistory` 字段 | 6 个字段 | **10 个字段** | 补全分类、经验、开始时间、加成明细 |
| `interactionHistory` | ❌ 不存在 | **新增数组** | 记录宠物互动历史 |
| `dailyInteractions` | 每日覆盖 | 保留不变 | 仅用于当日次数控制，不需要长期 |

### 2.4 存储空间估算

| 数据 | 每条大小 | 每年条数 | 每年占用 |
|------|---------|---------|---------|
| completedHistory | ~300B | ~2000（6任务/天 × 365天） | ~600KB |
| interactionHistory | ~100B | ~700（2次/天 × 365天） | ~70KB |
| **合计** | | | **~670KB/年** |

localStorage 上限通常 5-10MB，存 10 年数据也完全没问题。

---

## 三、功能设计

### 3.1 功能总览

```
家长面板
│
├── 任务管理 Tab（现有，不动）
├── 📅 周计划 Tab（现有，不动）
├── 🏆 挑战 Tab（现有，不动）
├── 🌅 早鸟 Tab（现有，不动）
├── 💰 积分 Tab（现有，微调）
│   ├── 当前星币余额 + 手动加减        （不动）
│   ├── 最近完成记录（10条）           （不动）
│   └── 🗑️ 测试数据管理               （不动）
│
├── 📊 统计 Tab（🆕 新增）
│   ├── 时间范围选择器（近7天 / 近30天 / 全部）
│   ├── 概览卡片
│   │   ├── 总完成次数
│   │   ├── 活跃天数
│   │   ├── 累计获得星币
│   │   ├── 总完成时长
│   │   └── 宠物互动次数
│   ├── 每日任务完成趋势图（柱状图）
│   ├── 每日完成时长趋势图（柱状图）
│   └── 每日时间范围图（浮动条形图：最早开始 ~ 最晚完成）
│
└── 📤 数据 Tab（🆕 新增）
    ├── 📦 完整备份（JSON）
    ├── 📊 每日汇总报表（CSV）
    └── 📋 任务完成明细（CSV）
```

### 3.2 统计 Tab 详细设计

#### 3.2.1 时间范围选择器

```
[ 近7天 ]  [ 近30天 ]  [ 全部 ]
```

- 默认选中「近7天」
- 切换范围后，所有图表和卡片数据自动刷新
- 纯前端过滤，不涉及网络请求

#### 3.2.2 概览卡片

5 个卡片横排（移动端自动换行），每个卡片显示数字 + 标签：

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ 47  │ │  8  │ │ 582 │ │ 12h │ │ 23  │
│完成数│ │天数  │ │星币  │ │时长  │ │互动  │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
```

| 卡片 | 说明 | 计算方式 |
|------|------|---------|
| 完成数 | 范围内完成的任务总数 | count(completedHistory) |
| 天数 | 范围内有完成记录的天数 | distinct dates count |
| 星币 | 范围内累计获得星币 | sum(coins) |
| 时长 | 范围内总完成时长 | sum(duration)，格式 `Xh Xm` |
| 互动 | 范围内宠物互动总次数 | count(interactionHistory) |

#### 3.2.3 每日任务完成趋势图

```
任务完成数量
 6 │          ██
 5 │       ██ ██ ██
 4 │    ██ ██ ██ ██ ██
 3 │ ██ ██ ██ ██ ██ ██ ██
 2 │ ██ ██ ██ ██ ██ ██ ██ ██
 1 │ ██ ██ ██ ██ ██ ██ ██ ██ ██
   └──────────────────────────
    4/19  4/20  4/21  4/22  4/23  4/24  4/25
```

- **类型**：纯 CSS / HTML 柱状图（不用外部图表库）
- **X 轴**：日期
- **Y 轴**：当天完成任务数
- **交互**：点击柱子可展开当天的任务明细列表

#### 3.2.4 每日完成时长趋势图

```
完成时长（分钟）
60 │          ██
45 │       ██ ██ ██
30 │    ██ ██ ██ ██ ██
15 │ ██ ██ ██ ██ ██ ██ ██
 0 │ ██ ██ ██ ██ ██ ██ ██ ██
   └──────────────────────────
    4/19  4/20  4/21  4/22  4/23  4/24  4/25
```

- **类型**：纯 CSS / HTML 柱状图
- **Y 轴**：当天总完成时长（分钟）
- **交互**：同上，点击展开明细

#### 3.2.5 每日时间范围图

用浮动条形图展示每天的活动时间跨度：

```
日期    时间轴（6:00 ~ 22:00）
        6   8   10  12  14  16  18  20  22
4/19    ████████████░░░░░░░░░░███████████
4/20    ████████░░░░░░░░░░░░░░████████
4/21    ░░░░░████████████████████░░░░
4/22    ████████████████████░░░░░░░░░░
4/23    ██████░░░░░░░░░░░░░░██████████
4/24    █████████████████████████████████
4/25    ████████████░░░░░░░░░███████████

  ████ = 有任务的时间段（最早开始 ~ 最晚完成）
```

- **X 轴**：时间（6:00 ~ 22:00，每小时一格）
- **每行**：一天
- **条形起点**：当天 earliest(startedAt)
- **条形终点**：当天 latest(completedAt)
- 无数据的日期不显示
- 悬停/点击显示详细信息（最早几点、最晚几点、跨度几小时）

#### 3.2.6 无数据提示

当范围内没有任何记录时，显示友好提示：

```
📋 这段时间还没有任务记录哦
   开始做任务后，这里会显示统计数据
```

### 3.3 导出功能详细设计

#### 3.3.1 📦 完整备份（JSON）

**用途**：全量数据备份，防丢失。

**导出内容**：整个 `localStorage['monster-pet-data']` 的完整副本，外加元信息。

**文件格式**：
```json
{
  "_meta": {
    "appName": "小怪兽养成记",
    "exportDate": "2026-04-25T14:17:00.000Z",
    "version": "3.0",
    "stats": {
      "completedTasks": 47,
      "interactionCount": 23,
      "dateRange": "2026-04-18 ~ 2026-04-25"
    }
  },
  // ... 全量业务数据
}
```

**文件名**：`打卡小达人_备份_2026-04-25.json`

#### 3.3.2 📊 每日汇总报表（CSV）

**用途**：家长分析孩子每天的整体表现，一张表看全局。

**CSV 表头**：

| 列名 | 说明 | 数据来源 |
|------|------|---------|
| 日期 | 2026-04-25 | completedHistory / interactionHistory 按日分组 |
| 任务完成数 | 当天完成几个任务 | count |
| 总完成时长 | 3小时20分 | sum(duration)，格式化为 H小时M分 |
| 最早开始时间 | 06:35 | min(startedAt)，格式 HH:MM |
| 最晚完成时间 | 21:15 | max(completedAt)，格式 HH:MM |
| 获得星币 | 38 | sum(coins) |
| 早鸟奖励次数 | 2 | count(isEarlyBird=true) |
| 喂食次数 | 1 | interactionHistory count(type=feed) |
| 玩耍次数 | 1 | interactionHistory count(type=play) |
| 喂食消耗星币 | 15 | interactionHistory sum(cost, type=feed) |

**文件名**：`打卡小达人_每日汇总_2026-04-25.csv`

**示例数据**：
```
日期,任务完成数,总完成时长,最早开始时间,最晚完成时间,获得星币,早鸟奖励次数,喂食次数,玩耍次数,喂食消耗星币
2026-04-18,5,1小时12分,06:35,19:20,32,2,1,1,15
2026-04-19,6,1小时45分,06:30,20:10,45,3,1,1,10
2026-04-20,4,58分,07:00,18:30,24,1,0,1,0
```

#### 3.3.3 📋 任务完成明细（CSV）

**用途**：查看每一条任务的详细信息，用于精细分析。

**CSV 表头**：

| 列名 | 说明 | 数据来源 |
|------|------|---------|
| 日期 | 2026-04-25 | completedAt 的日期部分 |
| 开始时间 | 06:35 | startedAt，格式 HH:MM |
| 完成时间 | 06:38 | completedAt，格式 HH:MM |
| 任务名称 | 语文作业 | title |
| 分类 | 学校作业 | category 映射为中文名 |
| 获得星币 | 8 | coins（含加成后的总额） |
| 经验值 | 10 | exp |
| 用时 | 3分20秒 | duration 格式化 |
| 早鸟奖励 | 是/否 | isEarlyBird |
| 加成明细 | 🔥连击+3 🌅早鸟+3 | bonusDetail 拼接 |

**文件名**：`打卡小达人_任务明细_2026-04-25.csv`

**示例数据**：
```
日期,开始时间,完成时间,任务名称,分类,获得星币,经验值,用时,早鸟奖励,加成明细
2026-04-25,06:35,06:38,语文作业,学校作业,8,10,3分20秒,是,🔥连击+3 🌅早鸟+3
2026-04-25,06:40,06:55,数学作业,学校作业,6,10,15分00秒,否,🔥连击+1
```

### 3.4 导出预览功能

所有导出操作在下载前**先弹出预览弹窗**，让家长确认数据内容。

#### 3.4.1 预览弹窗结构

```
┌───────────────────────────────────────┐
│  📊 每日汇总报表 · 预览               │
│                                       │
│  📅 数据范围：2026-04-18 ~ 2026-04-25 │
│  📋 共 8 天记录                       │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ 日期       完成数 时长  星币  互动 │  │
│  │ 2026-04-25   6   1h45m  45   2  │  │
│  │ 2026-04-24   5   1h12m  32   2  │  │
│  │ 2026-04-23   4   58m    24   1  │  │
│  │ ...                          │  │
│  │ 2026-04-18   3   35m    18   1  │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ⚠️ CSV 文件不含密码等敏感配置信息     │
│                                       │
│  [ 取消 ]              [ 📥 下载 CSV ] │
└───────────────────────────────────────┘
```

#### 3.4.2 三种导出的预览行为

| 导出类型 | 预览内容 | 表格显示 |
|---------|---------|---------|
| 📦 完整备份 | 显示 `_meta.stats` 摘要：记录数、日期范围、宠物数量 | 不显示数据表格（太长），只显示摘要信息 |
| 📊 每日汇总 | 数据范围 + 天数 + 完整 CSV 表格 | 全部行 |
| 📋 任务明细 | 数据范围 + 总条数 + 最近 20 条 CSV 表格 + 底部提示"共 X 条，预览前 20 条" | 截断显示 |

#### 3.4.3 预览弹窗交互

```
点击导出按钮 → 弹出预览弹窗
  ├── 点击「取消」→ 关闭弹窗
  └── 点击「下载 XXX」→ 关闭弹窗 + 自动下载文件 + toast 提示
```

- 预览弹窗为模态遮罩，点击遮罩背景也可关闭
- 表格区域可滚动（max-height 限高，内部 overflow-y: auto）

---

## 四、代码改动清单

### 4.1 `store.js` 改动

#### 改动 1：`_migrate()` 新增字段初始化

```js
// 在 _migrate() 中添加
if (!this._data.interactionHistory) this._data.interactionHistory = [];
```

#### 改动 2：`completeTask()` 补全 completedHistory 记录字段

**现在**（第 270-277 行）：
```js
history.unshift({
  taskId: task.id,
  title: task.title,
  coins: coinsEarned,
  duration: task.duration,
  isEarlyBird: task.isEarlyBird,
  completedAt: task.completedAt
});
```

**改为**：
```js
history.unshift({
  taskId: task.id,
  title: task.title,
  category: task.category || 'other',    // 🆕
  coins: coinsEarned,
  exp: expEarned,                         // 🆕
  duration: task.duration,
  startedAt: task.startedAt,              // 🆕
  completedAt: task.completedAt,
  isEarlyBird: task.isEarlyBird || false,
  bonusDetail: bonusDetail                // 🆕
});
```

#### 改动 3：移除 completedHistory 的 100 条上限

**删除**（第 279 行）：
```js
if (history.length > 100) history.length = 100;
```

#### 改动 4：`feedPet()` 新增互动记录

在 `feedPet()` 成功喂食后（return 之前），添加：
```js
const ih = this.get('interactionHistory') || [];
ih.unshift({
  type: 'feed',
  name: foodDefs[foodType]?.name || foodType,
  cost: food.coins,
  timestamp: new Date().toISOString()
});
this.set('interactionHistory', ih);
```

#### 改动 5：`playWithPet()` 新增互动记录

在 `playWithPet()` 成功玩耍后（return 之前），添加：
```js
const ih = this.get('interactionHistory') || [];
ih.unshift({
  type: 'play',
  name: choice.name,
  cost: 0,
  timestamp: new Date().toISOString()
});
this.set('interactionHistory', ih);
```

#### 改动 6：DEFAULT_DATA 新增字段

```js
interactionHistory: [],
```

### 4.2 `data-io.js` → 重构为 `stats-io.js`

重命名文件，同时承载统计展示和导出功能。

#### 改动 1：统计数据处理函数

```js
/**
 * 按日期聚合 completedHistory
 * @param {Array} history - completedHistory 数组
 * @param {string} range - '7d' | '30d' | 'all'
 * @returns {Array} 按日期聚合后的数组，每项 { date, count, totalDuration, totalCoins, ... }
 */
function aggregateByDate(history, range) { ... }

/**
 * 统计宠物互动
 * @param {Array} interactions - interactionHistory 数组
 * @param {string} range - '7d' | '30d' | 'all'
 * @returns {Array} 按日期聚合后的数组
 */
function aggregateInteractions(interactions, range) { ... }
```

#### 改动 2：图表渲染函数（纯 HTML/CSS）

```js
/**
 * 渲染柱状图（任务完成数 / 完成时长）
 * @param {HTMLElement} container - 挂载容器
 * @param {Array} data - aggregateByDate() 返回的数据
 * @param {string} type - 'count' | 'duration'
 * @param {Function} onBarClick - 点击柱子时的回调（展开明细）
 */
function renderBarChart(container, data, type, onBarClick) { ... }

/**
 * 渲染时间范围图（浮动条形图）
 * @param {HTMLElement} container - 挂载容器
 * @param {Array} data - aggregateByDate() 返回的数据
 */
function renderTimelineChart(container, data) { ... }
```

#### 改动 3：统计 Tab 渲染函数

```js
/**
 * 渲染统计 Tab 全部内容
 * @param {HTMLElement} container - 挂载容器
 */
function renderStatsTab(container) { ... }
```

#### 改动 4：数据 Tab 渲染函数 + 导出预览弹窗

```js
/**
 * 渲染数据 Tab（导出区域）
 * @param {HTMLElement} container - 挂载容器
 */
function renderDataTab(container) { ... }

/**
 * 弹出导出预览弹窗
 * @param {string} type - 'json' | 'daily-summary' | 'task-detail'
 * @param {Object} previewData - 预览数据
 */
function showExportPreview(type, previewData) { ... }

/**
 * CSV 生成函数
 */
function generateDailySummaryCSV() { ... }
function generateTaskDetailCSV() { ... }

/**
 * JSON 备份生成函数
 */
function generateJSONBackup() { ... }
```

### 4.3 `parent-panel.js` 改动

#### 改动 1：Tab 栏新增两个 Tab

**现在**（第 130-134 行）：
```js
<button class="ptab active" data-tab="task-mgmt">任务管理</button>
<button class="ptab" data-tab="plan">📅 周计划</button>
<button class="ptab" data-tab="challenge">🏆 挑战</button>
<button class="ptab" data-tab="earlybird">🌅 早鸟</button>
<button class="ptab" data-tab="coins">💰 积分</button>
```

**改为**：
```js
<button class="ptab active" data-tab="task-mgmt">任务管理</button>
<button class="ptab" data-tab="plan">📅 周计划</button>
<button class="ptab" data-tab="challenge">🏆 挑战</button>
<button class="ptab" data-tab="earlybird">🌅 早鸟</button>
<button class="ptab" data-tab="coins">💰 积分</button>
<button class="ptab" data-tab="stats">📊 统计</button>       // 🆕
<button class="ptab" data-tab="data">📤 数据</button>       // 🆕
```

#### 改动 2：`renderParentTabContent()` 新增 case

```js
case 'stats': renderStatsTab(content); break;   // 🆕
case 'data':  renderDataTab(content); break;    // 🆕
```

#### 改动 3：积分 Tab 清理

- 移除积分 Tab 中的「导出 JSON」「导出 CSV」等旧按钮（已迁移到数据 Tab）
- 保留星币余额、手动加减、最近完成记录、测试数据管理

### 4.4 `index.html` 改动

```html
<!-- 旧 -->
<script src="js/data-io.js"></script>

<!-- 改为 -->
<script src="js/stats-io.js"></script>
```

### 4.5 不改动的文件

- `pet-interaction.js`：喂食/玩耍的 UI 逻辑不动，数据记录在 store 层完成
- `css/`：统计和数据导出区域使用内联样式或 `stats-io.js` 中的 `<style>` 注入，不新增 CSS 文件

---

## 五、页面 UI 布局

### 5.1 家长面板 Tab 栏（改后）

```
┌──────────────────────────────────────────────────────┐
│ 任务管理 │ 📅周计划 │ 🏆挑战 │ 🌅早鸟 │ 💰积分 │ 📊统计 │ 📤数据 │
└──────────────────────────────────────────────────────┘
```

7 个 Tab 横向排列，移动端超出时横向滚动。

### 5.2 📊 统计 Tab 布局

```
┌─────────────────────────────────────┐
│  [ 近7天 ]  [ 近30天 ]  [ 全部 ]     │  ← 时间范围选择器
├─────────────────────────────────────┤
│  概览                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐│
│  │ 47 │ │  8 │ │582 │ │ 12h│ │ 23 ││
│  │完成数│ │天数  │ │星币  │ │时长  │ │互动  ││
│  └────┘ └────┘ └────┘ └────┘ └────┘│
├─────────────────────────────────────┤
│  每日任务完成数量                     │
│                                     │
│  6 │          ██                    │
│  5 │       ██ ██ ██                 │
│  4 │    ██ ██ ██ ██ ██              │
│  3 │ ██ ██ ██ ██ ██ ██ ██           │
│  2 │ ██ ██ ██ ██ ██ ██ ██ ██        │
│    └─────────────────────           │
│     4/19 4/20 4/21 4/22 4/23 4/24  │
├─────────────────────────────────────┤
│  每日完成时长（分钟）                 │
│                                     │
│ 60 │          ██                    │
│ 45 │       ██ ██ ██                 │
│ 30 │    ██ ██ ██ ██ ██              │
│ 15 │ ██ ██ ██ ██ ██ ██ ██           │
│    └─────────────────────           │
│     4/19 4/20 4/21 4/22 4/23 4/24  │
├─────────────────────────────────────┤
│  每日活动时间范围                     │
│       6  8  10  12  14  16  18  20  │
│  4/19 ████████████░░░░████████████  │
│  4/20 ████████░░░░░░░░░████████    │
│  4/21 ░░░░██████████████████░░░░    │
│  4/22 █████████████████████░░░░░░   │
│  4/23 ██████░░░░░░░░░░██████████   │
│  4/24 █████████████████████████████ │
└─────────────────────────────────────┘
```

### 5.3 📤 数据 Tab 布局

```
┌─────────────────────────────────────┐
│  📤 数据管理                         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 📦 完整备份                   │  │
│  │ 导出所有数据为 JSON 文件       │  │
│  │ 用于数据恢复、换设备迁移       │  │
│  │                    [预览并导出]│  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 📊 每日汇总报表               │  │
│  │ 每天完成数、时长、时间范围等    │  │
│  │ 适合整体趋势分析              │  │
│  │                    [预览并导出]│  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 📋 任务完成明细               │  │
│  │ 每条任务的详细时间和加成信息    │  │
│  │ 适合精细分析                  │  │
│  │                    [预览并导出]│  │
│  └──────────────────────────────┘  │
│                                     │
│  💡 提示：所有导出在本地完成，        │
│  不经过任何网络。CSV 不含密码等      │
│  敏感配置信息。                     │
└─────────────────────────────────────┘
```

### 5.4 导出预览弹窗布局

```
┌───────────────────────────────────────┐
│          📊 每日汇总报表 · 预览        │
│                                       │
│  📅 数据范围：2026-04-18 ~ 2026-04-25 │
│  📋 共 8 天记录                       │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ 日期        完成  时长   星币 互动 │  │
│  │────────────────────────────────│  │
│  │ 2026-04-25   6  1h45m   45   2 │  │
│  │ 2026-04-24   5  1h12m   32   2 │  │
│  │ 2026-04-23   4   58m    24   1 │  │
│  │ 2026-04-22   5  1h30m   38   1 │  │
│  │ 2026-04-21   4   45m    22   2 │  │
│  │ 2026-04-20   6  2h05m   48   1 │  │
│  │ 2026-04-19   5  1h20m   30   2 │  │
│  │ 2026-04-18   3   35m    18   1 │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ⚠️ CSV 文件不含密码等敏感配置信息     │
│                                       │
│       [ 取消 ]      [ 📥 下载 CSV ]   │
└───────────────────────────────────────┘
```

---

## 六、数据安全与边界

### 6.1 存储安全

- completedHistory 和 interactionHistory **不设上限**
- 但自然受 localStorage 容量限制（5-10MB），超出时浏览器会抛异常
- 实际数据量：约 670KB/年，10 年也只占 ~7MB，在安全范围内
- 如果未来确实超限，可在导出时提示用户清理

### 6.2 导出安全

- 所有导出为本地文件下载，**不经过任何网络**
- JSON 文件包含全量数据（含密码），注意不要随意分享
- CSV 文件只包含历史记录，**不含密码等敏感配置**
- 预览弹窗会标注安全提示

### 6.3 清除操作影响

- 「清除所有任务和完成记录」→ 同时清除 completedHistory 和 interactionHistory
- 「重置全部数据」→ 全部清空（含历史记录），无恢复可能

### 6.4 图表性能边界

- 柱状图：纯 CSS div 实现，无渲染性能问题
- 时间范围图：同上
- 超过 365 天的数据：柱状图自动合并为周粒度显示，时间范围图只显示最近 90 天
- 不使用 Canvas / SVG / 外部图表库，零额外内存开销

---

## 七、兼容性考虑

### 7.1 旧数据兼容

现有用户的 `completedHistory` 字段较少（没有 category、exp、startedAt、bonusDetail）。迁移策略：

- `_migrate()` 中不补旧记录的缺失字段
- 统计图表中，缺失字段跳过或显示为 0
- CSV 导出时，缺失字段显示为空（`""`），不会报错
- JSON 备份/恢复不受影响（原样保存和恢复）

### 7.2 浏览器兼容

- `Blob` + `URL.createObjectURL`：所有现代浏览器支持
- CSV 使用 BOM (`\uFEFF`) 确保 Excel 正确识别 UTF-8
- 图表使用纯 CSS（flex、grid、百分比高度），无兼容性风险

---

## 八、实施优先级

| 优先级 | 改动 | 工作量 | 说明 |
|--------|------|--------|------|
| **P0** | store.js：补全 completedHistory 字段 + 移除 100 条上限 | 小 | 数据基础 |
| **P0** | store.js：新增 interactionHistory 记录（feedPet + playWithPet） | 小 | 数据基础 |
| **P0** | store.js：_migrate() + DEFAULT_DATA 新增 interactionHistory | 小 | 数据基础 |
| **P1** | stats-io.js：统计数据处理 + 概览卡片 | 中 | 统计核心 |
| **P1** | stats-io.js：柱状图渲染（完成数 + 时长） | 中 | 统计可视化 |
| **P1** | stats-io.js：时间范围图渲染 | 中 | 统计可视化 |
| **P1** | parent-panel.js：新增「统计」Tab + 「数据」Tab | 小 | 集成 |
| **P2** | stats-io.js：导出预览弹窗 | 中 | 导出体验 |
| **P2** | stats-io.js：三种导出功能（JSON + 2种CSV） | 中 | 导出功能 |
| **P2** | parent-panel.js：积分 Tab 清理旧导出按钮 | 小 | 清理 |

**总工作量**：P0 约 30 分钟，P1 约 2 小时，P2 约 1.5 小时。

---

## 九、为什么不做导入功能

1. **实际场景极少**：孩子只有一个设备，不需要跨设备迁移
2. **风险高于收益**：导入覆盖全量数据，误操作可能导致数据丢失
3. **有 JSON 备份兜底**：如果真的需要恢复，手动把 JSON 文件内容粘贴到浏览器 DevTools 的 localStorage 中即可（对豆豆龙来说不是问题）
4. **减少代码复杂度**：砍掉导入后，省去文件选择器、校验逻辑、预览确认弹窗等约 100 行代码

如果未来确实有跨设备需求，可以再考虑加回来。
