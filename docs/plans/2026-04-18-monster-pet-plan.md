# 小怪兽养成记 — 开发计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个面向 8-12 岁儿童的任务管理+电子宠物养成 SPA 应用

**Architecture:** 纯前端 SPA，零依赖（原生 HTML/CSS/JS），数据存 localStorage。采用模块化文件结构，每个页面/功能独立文件，通过事件总线通信。T1 写好全部页面空容器，后续 Task 只做动态渲染，不再改 index.html。断点友好——每个 Task 完成后都能独立运行查看效果。

**Tech Stack:** HTML5 + CSS3 + Vanilla JS（零依赖，离线可用）

**断点续做策略：** 每个 Task 对应 1-2 个文件，完成后立即可预览。下一个 Task 读取已完成文件继续开发。任何位置中断均可从下一个 Task 继续。

---

## 项目文件结构

```
monster-pet/
├── index.html              # 入口 HTML（T1 创建，包含全部页面空容器）
├── manifest.json           # PWA 清单（T1 创建，iPad 主屏幕安装）
├── sw.js                   # Service Worker 离线缓存（T1 创建）
├── css/
│   ├── base.css            # 全局样式、CSS 变量、字体（T1）
│   ├── components.css      # 通用组件样式（T1）
│   ├── pet.css             # 宠物乐园样式（T3）
│   ├── task.css            # 任务中心样式（T5）
│   ├── shop.css            # 商店样式（T8）
│   └── parent.css          # 家长面板样式（T9）
├── js/
│   ├── app.js              # 主应用入口、路由、事件总线（T1）
│   ├── store.js            # 数据层 localStorage 持久化（T2）
│   ├── onboarding.js       # 首次打开引导流程（T2）
│   ├── pet-renderer.js     # 宠物 Canvas 绘制（T3a 创建，T3b 补全）
│   ├── pet-interaction.js  # 宠物互动逻辑（T4）
│   ├── task-list.js        # 任务列表渲染（T5）
│   ├── task-parser.js      # 本地规则解析器（T6）
│   ├── task-ai.js          # AI API 解析（T6）
│   ├── task-creator.js     # 任务创建流程（T6）
│   ├── task-templates.js   # 任务模板库（T6）
│   ├── weekly-plan.js      # 周计划管理 + 每日自动生成（T7.5）
│   ├── reminder.js         # 定时提醒（T7）
│   ├── shop.js             # 星币商店（T8）
│   └── parent-panel.js     # 家长面板（T9）
└── assets/
    └── (无外部资源，全部 CSS/Canvas 内联绘制)
```

---

## Task 1: 项目骨架 + 基础样式 + 底部导航 + 首次引导 + PWA

**预计时间：** 10-15 分钟（6 个文件，含 PWA manifest + Service Worker）
**可断点：** ✅ 完成后可打开 index.html 看到空壳+底部导航+首次引导弹窗；iPad 可"添加到主屏幕"

**文件：**
- 创建: `monster-pet/index.html`
- 创建: `monster-pet/manifest.json`
- 创建: `monster-pet/sw.js`
- 创建: `monster-pet/css/base.css`
- 创建: `monster-pet/css/components.css`
- 创建: `monster-pet/js/app.js`

**实现内容：**
1. `index.html` — 完整 HTML 骨架：
   - `<head>` 引入所有 CSS 文件（含后续 Task 的，提前写好 `<link>`，文件不存在时不影响加载）
   - `<head>` 引入 `manifest.json`（PWA 清单）+ 主题色 meta 标签 + Apple 触屏图标 meta
   - `<body>` 底部引入所有 JS 文件（同样提前写好 `<script>`）
   - 4 个页面空容器：`#page-pet` / `#page-tasks` / `#page-shop` / `#page-parent`
   - 底部导航栏 4 个 tab（宠物乐园🐾 / 任务中心📋 / 星币商店🏪 / 家长👨‍👩‍👧）
   - 导航栏左侧显示当前星币余额（💰 50）
   - 引导弹窗容器 `#onboarding-overlay`（3 步引导）
   - Toast 通知容器 `#toast-container`（固定底部中央）
   - 确认弹窗容器 `#confirm-dialog`（通用二次确认）
   - **后续 Task 不再修改 index.html**
2. `manifest.json` — PWA 清单：
   - `name`: "小怪兽养成记"
   - `short_name`: "小怪兽"
   - `start_url`: "./index.html"
   - `display`: "standalone"（全屏，无浏览器 UI）
   - `background_color`: "#FFF8E7"（奶油色）
   - `theme_color`: "#FF9A56"（橙色主题）
   - `orientation`: "portrait"（竖屏）
   - `icons`: 192×192 和 512×512（用 Canvas 动态生成或 base64 内联猫咪 emoji 图标，无需外部图片文件）
   - `categories`: ["education", "kids"]
3. `sw.js` — Service Worker 离线缓存：
   - `install` 事件：预缓存所有静态资源（html/css/js）
   - `fetch` 事件：缓存优先策略（离线时从缓存读取）
   - `activate` 事件：清理旧版本缓存
   - 缓存名：`monster-pet-v1`（版本号，后续更新时改 v2 自动清除旧缓存）
4. `app.js` — 主入口中注册 Service Worker：`if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')`
5. `base.css` — CSS 变量定义（奶油色系配色、字体），全局重置，body 基础样式
   - 色板：`--bg-cream` / `--accent-orange` / `--accent-green` / `--text-brown` 等
   - 字体：Google Fonts 引入一个手写风 display 字体 + 一个清晰正文字体
6. `components.css` — 底部导航栏样式，通用卡片、按钮样式，Toast 样式，引导弹窗样式，确认弹窗样式
4. `app.js` — 页面路由（hash 路由 #pet / #tasks / #shop / #parent），事件总线 EventEmitter，页面切换动画，全局 Toast 函数 `showToast(msg, type)`

**验收标准：** 打开 index.html，看到首次引导弹窗（3 步），走完后看到底部 4 个 tab + 左下角星币余额，点击切换页面有淡入动画。iPad Safari 中点击"添加到主屏幕"后，桌面出现"小怪兽"图标，打开后全屏无地址栏，离线也能正常显示。

---

## Task 2: 数据层 Store（localStorage 持久化）+ 首次引导逻辑

**预计时间：** 12-18 分钟（2 个文件，数据模型大+业务方法多+星币计算+打卡逻辑）
**可断点：** ✅ 完成后其他模块可调用 store 读写数据，首次引导功能完整

**文件：**
- 创建: `monster-pet/js/store.js`
- 创建: `monster-pet/js/onboarding.js`

**数据模型：**

```js
{
  user: {
    name: '小探险家',
    coins: 50,            // 星币余额
    streak: 0,            // 连续打卡天数
    lastActiveDate: null, // 上次活跃日期（YYYY-MM-DD 格式）
  },
  pets: [
    {
      id: 'pet_1',
      name: '小团子',
      type: 'cat',       // cat/fish/turtle/luna/fairy/octopus
      stage: 1,           // 0蛋 1幼崽 2少年 3成年
      exp: 0,             // 累计经验值
      hunger: 80,         // 饱食度 0-100
      mood: 70,           // 心情值 0-100
      energy: 90,         // 活力值 0-100
      sick: false,        // 是否生病
      active: true,       // 是否为当前陪伴宠物
      accessories: [],    // 装饰品 id 列表
      masterLevel: 0,     // 成年后大师等级（每500经验升1级）
      createdAt: '2026-04-18T00:00:00'
    }
  ],
  tasks: [
    // 初始示例数据：首次安装时展示，家长配置周计划后不再使用
    // 周计划生效后，每天的任务由 weeklyPlan[today] 自动生成
    {
      id: 'task_1',
      title: '语文作业',
      category: 'school',
      subtasks: [],             // 无子任务，直接完成
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',        // pending → active → completed
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,          // ⏱️ 点击"开始"时记录（时间戳）
      completedAt: null,        // 完成时记录
      duration: null,           // 完成耗时（秒）
      isEarlyBird: false,       // 🌅 是否早鸟任务
      // isEfficient 已移除：不再设固定效率阈值，仅做耗时统计
      coinsEarned: null,        // 本次实际获得的星币（含加成明细）
      createdAt: '2026-04-18T00:00:00',
      lastResetDate: null
    },
    {
      id: 'task_2',
      title: '数学作业',
      category: 'school',
      subtasks: [],             // 无子任务，直接完成（已包含口算）
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      createdAt: '2026-04-18T00:00:00',
      completedAt: null,
      lastResetDate: null
    },
    {
      id: 'task_3',
      title: '圆圆老师（数学）',
      category: 'tutoring',
      subtasks: [{ id: 'st_3_1', text: '课后巩固', done: false }, { id: 'st_3_2', text: '专属探索', done: false }],
      deadline: '2026-04-19T20:00:00',
      repeat: 'weekly',
      coins: 8,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      createdAt: '2026-04-18T00:00:00',
      completedAt: null,
      lastResetDate: null
    },
    {
      id: 'task_4',
      title: 'Daniel 作业（英语）',
      category: 'tutoring',
      subtasks: [{ id: 'st_4_1', text: 'Workbook', done: false }],
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      createdAt: '2026-04-18T00:00:00',
      completedAt: null,
      lastResetDate: null
    },
    {
      id: 'task_5',
      title: '每日阅读',
      category: 'reading',
      subtasks: [],             // 无子任务，直接完成
      deadline: null,
      repeat: 'daily',
      coins: 4,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      createdAt: '2026-04-18T00:00:00',
      completedAt: null,
      lastResetDate: null
    },
    {
      id: 'task_6',
      title: '钢琴练习',
      category: 'hobby',
      subtasks: [],             // 无子任务，直接完成
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      createdAt: '2026-04-18T00:00:00',
      completedAt: null,
      lastResetDate: null
    }
  ],
  myTemplates: [],              // 用户自定义模板（初始为空）
  weeklyPlan: {
    // 周计划模板（0=周日, 1=周一 ... 6=周六）
    1: [ // 周一
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_school_english', coins: 5, isTimed: false },
      { templateId: 'default_tutoring_daniel', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    2: [ // 周二
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_school_english', coins: 5, isTimed: false },
      { templateId: 'default_tutoring_daniel', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    3: [ // 周三
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    4: [ // 周四（钢琴课当天不安排钢琴练习）
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    5: [ // 周五
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    6: [ // 周六（圆圆老师课 + 阅读练琴，Daniel课本身不加入任务）
      { templateId: 'default_tutoring_yuanyuan', coins: 8, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false }
    ],
    0: []  // 周日（自由安排）
  },
  earlyBirdConfig: {
    // 每天的早鸟时间配置（0=周日, 1=周一 ... 6=周六）
    0: { enabled: true, time: '08:30' },  // 周日
    1: { enabled: true, time: '06:30' },  // 周一
    2: { enabled: true, time: '06:30' },  // 周二
    3: { enabled: true, time: '06:30' },  // 周三
    4: { enabled: true, time: '06:30' },  // 周四
    5: { enabled: true, time: '06:30' },  // 周五
    6: { enabled: false, time: null },     // 周六关闭
  },
  challenges: [
    {
      id: 'ch_1',
      title: '连续3天打卡',
      description: '每天至少完成1个任务，坚持3天！',
      bonusCoins: 20,
      accepted: false,
      completed: false,
      completedAt: null,
      weeklyReset: null
    },
    {
      id: 'ch_2',
      title: '超级阅读王',
      description: '一周读完2本中文书，变身阅读达人！',
      bonusCoins: 30,
      accepted: false,
      completed: false,
      completedAt: null,
      weeklyReset: null
    },
    {
      id: 'ch_3',
      title: '英语小达人',
      description: '一周完成5次英文阅读，你好厉害！',
      bonusCoins: 30,
      accepted: false,
      completed: false,
      completedAt: null,
      weeklyReset: null
    },
    {
      id: 'ch_4',
      title: '运动小健将',
      description: '连续5天完成体育运动，身体棒棒！',
      bonusCoins: 25,
      accepted: false,
      completed: false,
      completedAt: null,
      weeklyReset: null
    },
    {
      id: 'ch_5',
      title: '作文小作家',
      description: '独立写一篇300字以上作文，真了不起！',
      bonusCoins: 20,
      accepted: false,
      completed: false,
      completedAt: null,
      weeklyReset: null
    }
  ],
  shopItems: [],            // 已购买商品 id 列表
  parentPassword: '0000',
  parentUnlockedAt: null,
  onboardingDone: false,
  remindedTasks: [],        // 已提醒的 task id（避免重复）
  settings: {
    decaySpeed: 'normal',  // strict/normal/relaxed
    aiApiKey: ''
  },
  completedHistory: []      // 完成记录 [{taskId, title, coins, duration, isEarlyBird, completedAt}]
}
```

**实现内容：**
1. Store 类：
   - `init()` — 检查 localStorage，有则加载，无则写入默认数据
   - `get(key)` — 支持 `store.get('user.coins')` 点号路径访问
   - `set(key, value)` — 支持路径，如 `store.set('user.coins', 100)`
   - `reset()` — 清除 localStorage，重新写入默认数据
   - 每次 `set` 自动持久化 + 触发事件总线 `'data:changed'`
2. 核心业务方法（放在 Store 类中）：
   - `completeTask(taskId)` — 标记任务完成，计算实际星币（基础+连击加成），计算经验值，写入 completedHistory，更新连续打卡，触发经验值检查
   - `completeSubtask(taskId, subtaskId)` — 标记子任务完成，+3 经验值，检查是否全部完成
   - `feedPet(foodType)` — 根据 foodType 扣星币+修改状态值，偏好食物额外 +5 经验
   - `playWithPet()` — 随机选择互动类型，更新 mood/energy，+3 经验
   - `buyItem(itemId)` — 扣星币，添加到 shopItems，应用效果
   - `checkStreak()` — 检查并更新连续打卡（中断即重置，加火力模式）
   - `checkEvolution(petId)` — 检查是否达到进化阈值
   - `checkSick(petId)` — 检查是否生病（任一属性降到 0）
   - `resetRepeatTasks()` — 每日/每周重复任务刷新
3. `onboarding.js`：
   - 检查 `store.get('onboardingDone')`，未完成则显示引导弹窗
   - Step 1：输入宠物名字 → 写入 `store.set('pets[0].name', name)`
   - Step 2：展示默认宠物（小猫咪幼崽形态）+ 一句话说明"完成任务就能让它长大哦！"
   - Step 3：引导去任务中心
   - 完成后设置 `onboardingDone: true`

**经验值与星币计算规则（硬编码在 completeTask 中）：**
```js
// 基础星币
let coinsEarned = task.coins;
let bonusDetail = []; // 加成明细（用于结算弹窗展示）

// 连击加成（中断重置，加火力模式）
let streakBonus = Math.min(store.get('user.streak'), 10); // 上限10，鼓励长期坚持
if (streakBonus > 0) {
  coinsEarned += streakBonus;
  bonusDetail.push({ icon: '🔥', label: '连击', value: streakBonus });
}

// 早鸟奖励（在当天早鸟时间前开始）
const todayIndex = new Date().getDay(); // 0=周日
const earlyBirdConfig = store.get('earlyBirdConfig');
const todayConfig = earlyBirdConfig && earlyBirdConfig[todayIndex];
if (todayConfig && todayConfig.enabled && task.startedAt) {
  const startTime = new Date(task.startedAt);
  const [h, m] = todayConfig.time.split(':').map(Number);
  if (startTime.getHours() < h || (startTime.getHours() === h && startTime.getMinutes() <= m)) {
    coinsEarned += 3;
    bonusDetail.push({ icon: '🌅', label: '早鸟', value: 3 });
    task.isEarlyBird = true;
  }
}

// 经验值 = 基础星币 × 2（加成不加经验）
let expEarned = task.coins * 2;

// 提前完成奖励（一次性任务且未到截止时间）
if (task.repeat === 'once' && task.deadline && Date.now() < new Date(task.deadline)) {
  coinsEarned = Math.ceil(coinsEarned * 1.5);
  expEarned = Math.ceil(expEarned * 1.5);
}

// 记录实际获得
task.coinsEarned = { total: coinsEarned, bonus: bonusDetail };
```

**连续打卡规则（中断即重置，加火力模式）：**
```js
checkStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = store.get('user.lastActiveDate');
  if (lastDate === today) return; // 今天已经打过卡

  const last = new Date(lastDate);
  const now = new Date(today);
  const gapDays = Math.floor((now - last) / 86400000);

  if (gapDays === 1) {
    // 连续 → streak +1
    store.set('user.streak', store.get('user.streak') + 1);
  } else if (gapDays > 1) {
    // 中断 → streak 归零，重新开始
    store.set('user.streak', 0);
  }
  // gapDays === 0 不应出现（上面已拦截）

  store.set('user.lastActiveDate', today);
}
```

**验收标准：** 清除 localStorage 后打开页面，显示引导流程，输入名字后宠物名字更新。控制台 `store.get('tasks').length` 返回 6。控制台 `store.get('challenges').length` 返回 5。

---

## Task 3a: 宠物乐园 - 页面框架 + 猫咪绘制 + 状态展示

**预计时间：** 10-15 分钟（2 个文件，先做页面框架 + 1 种宠物验证渲染管线，保证跑通）
**可断点：** ✅ 完成后 #pet 页面能看到猫咪 + 三个状态环 + 呼吸动画

**文件：**
- 创建: `monster-pet/css/pet.css`
- 创建: `monster-pet/js/pet-renderer.js`

**实现内容：**
1. 宠物乐园页面结构（动态渲染到 `#page-pet` 容器）：
   - 顶部：宠物名字 + 切换按钮（🔄）+ 经验进度条文案（如"幼崽 120/200 → 少年"，成年后显示"大师 Lv.1"）
   - 中间：Canvas 画布（300×300）绘制宠物
   - 下方：三个圆形状态环（饱食度🍖 / 心情💛 / 活力⚡）
   - 底部预留互动按钮区域（T4 填充）
2. `pet-renderer.js` — 宠物 Canvas 绘制引擎：
   - **PET_TYPES 配置**（6 种宠物元信息）：
     ```
     cat:    { name:'小猫咪', emoji:'🐱', color:'#FFB6C1', eggColor:'#FFE4E1' }
     fish:   { name:'小孔雀鱼', emoji:'🐟', color:'#FFB6C1', eggColor:'#FFF0F5' }
     turtle: { name:'小乌龟', emoji:'🐢', color:'#90EE90', eggColor:'#F0FFF0' }
     luna:   { name:'露娜', emoji:'🐉', color:'#F8F8FF', eggColor:'#FFF5EE' }
     fairy:  { name:'小精灵', emoji:'🧚', color:'#E6E6FA', eggColor:'#F5F5FF' }
     octopus:{ name:'小章鱼', emoji:'🐙', color:'#DDA0DD', eggColor:'#F3E5F5' }
     ```
   - `drawPet(ctx, pet, frame)` — 根据 pet.type 分发到不同绘制函数（本 Task 只实现 drawCat，其余 5 种留占位 fallback 显示 emoji + 蛋形）
   - `drawCat(ctx, stage, frame, mood, sick)` — 猫咪完整 4 阶段：
     - Stage 0（蛋）：椭圆 + 粉色斑点 + 轻微晃动
     - Stage 1（幼崽）：圆脸+三角耳朵+大眼睛+小身体，呼吸动画（scale 0.98-1.02）
     - Stage 2（少年）：加长尾巴+胡须，偶尔跳跃
     - Stage 3（成年）：完整形态 + 光效 + 闲置摇尾巴动画
   - `requestAnimationFrame` 循环驱动动画（60fps）
   - 表情逻辑：hunger<30 轻微皱眉 / mood<30 打哈欠🥱 / 正常微笑
   - 任一属性 < 20 → 抱枕头打瞌睡😴
   - 生病状态（sick: true）→ 红十字会图标，灰色 + 颤抖
   - 装饰品绘制：读取 pet.accessories，在宠物头部上方绘制
3. 状态环用 SVG circle `stroke-dasharray` 实现，颜色根据值变化：>60 绿色 / 20-60 橙色 / <20 红色
4. `pet.css` — 宠物乐园页面样式

**验收标准：** 切到宠物乐园，看到 Canvas 绘制的小猫咪（默认宠物）+ 三个状态进度环 + 名字和经验条。猫咪有呼吸动画，状态值实时反映。

---

## Task 3b: 宠物乐园 - 其余 5 种宠物绘制

**预计时间：** 12-18 分钟（1 个文件，在 pet-renderer.js 中补全 5 个 drawXxx 函数，T3a 已验证管线）
**可断点：** ✅ 完成后购买神秘宠物蛋可看到不同宠物，每种 4 阶段

**文件：**
- 修改: `monster-pet/js/pet-renderer.js`

**实现内容：**
补全 `drawPet()` 中其余 5 种宠物的分发和绘制函数：
1. `drawFish(ctx, stage, frame, mood, sick)` — 孔雀鱼：
   - Stage 0：白色带粉色斑点椭圆蛋
   - Stage 1：白色圆身体 + 粉色鱼鳍 + 小尾巴
   - Stage 2：加长鱼尾，游动摆尾动画
   - Stage 3：华丽白色粉色渐变大扇尾 + 光泽
2. `drawTurtle(ctx, stage, frame, mood, sick)` — 乌龟：
   - Stage 0：绿色斑点蛋
   - Stage 1：圆壳 + 小头 + 四短腿
   - Stage 2：壳加六边形花纹
   - Stage 3：完整形态，偶尔缩头
3. `drawLuna(ctx, stage, frame, mood, sick)` — 露娜·光煞：
   - Stage 0：珍珠白色椭圆 + 银色光纹斑点 + 柔和发光
   - Stage 1：圆润白色小身体 + 大蓝色猫眼竖瞳 + 短小翅膀 + 背部细棱线
   - Stage 2：加大翅膀展开 + 三角形尾鳍 + 头侧凸起明显
   - Stage 3：完整飞行姿态 + 珍珠白鳞片光泽 + 喷火隐形闪光特效（身体边缘发出微光）
4. `drawFairy(ctx, stage, frame, mood, sick)` — 精灵：
   - Stage 0：淡紫色斑点蛋
   - Stage 1：小身体 + 透明小翅膀 + 微光
   - Stage 2：翅膀变大有花纹
   - Stage 3：发光飞行 + 粒子特效
5. `drawOctopus(ctx, stage, frame, mood, sick)` — 章鱼：
   - Stage 0：淡紫色斑点蛋
   - Stage 1：圆头 + 4 条短触手
   - Stage 2：6 条触手 + 吸盘细节
   - Stage 3：8 条触手 + 墨汁喷射动画
6. 移除 `drawPet()` 中的 fallback 占位逻辑，改为全部走真实绘制函数

**验收标准：** 修改默认宠物类型为 fish/turtle/luna/fairy/octopus（或通过商店购买宠物蛋），每种宠物 4 个阶段都能正确显示，动画流畅。

---

## Task 4: 宠物乐园 - 互动功能（喂食/玩耍）+ 气泡语 + 宠物切换

**预计时间：** 10-15 分钟（1 个文件，食物面板+随机互动+气泡语+宠物切换，逻辑较杂）
**可断点：** ✅ 完成后可实际操作宠物互动

**文件：**
- 创建: `monster-pet/js/pet-interaction.js`

**实现内容：**
1. 两个互动按钮（渲染到 T3 预留区域）：
   - 🍎 喂食 → 弹出食物选择面板（4 格网格）
   - 🎮 一键玩耍 → 随机播放一种动画
2. **喂食食物选择面板**（底部弹出 mini sheet）：
   - 只显示当前宠物**可吃的食物**（按 PET_TYPES 配置的 canEat 数组过滤）
   - 🍪 小饼干（3 星币，全部宠物可用）
   - 🍖 超级肉骨头（10 星币，猫咪/乌龟/露娜可吃）
   - 🍰 梦幻蛋糕（15 星币，猫咪/精灵/露娜可吃）
   - 🍬 能量糖果（5 星币，猫咪/章鱼/精灵可吃）
   - 🦐 小虾米（8 星币，小孔雀鱼可吃）
   - 🌿 鲜嫩蔬菜（6 星币，乌龟可吃）
   - 未购买的显示 🔒+ 价格
   - 选择后播放吃东西动画（1.5s）→ 调用 `store.feedPet(foodType)` → 气泡语
3. **玩耍随机互动**（每次随机一种）：
   - 🎾 扔球球：宠物跳起接球→摇尾巴（心情 +25，活力 -10）
   - 🫧 吹泡泡：吹出一串泡泡→飘走破裂（心情 +20，活力 -5）
   - 🎵 音乐时间：左右摇摆跳舞（心情 +15，活力 -15）
4. **互动后气泡语**（Canvas 上方冒出气泡，3 秒后消失）：
   - 鼓励语（随机）："主人今天真棒！" / "今天的你比昨天更厉害了！" 等
   - 任务提醒（有未完成任务时 50% 概率）："还有 N 个任务没做完哦~"
   - 打卡鼓励（连续打卡 > 0 时 20% 概率）："连续打卡 D 天了，好厉害！"
   - 偏好食物反馈："哇！这个好好吃！最喜欢了！"
5. 限制条件：
   - 星币不足（<3）时喂食按钮置灰
   - 生病状态：两个按钮均变灰，Toast"宠物生病了，快去完成任务帮它恢复吧！"
   - 活力不足（<10）：玩耍按钮变灰，Toast"太累了，先休息一下吧~"
6. 宠物切换功能：
   - 点击名字旁 🔄 按钮 → 弹出宠物列表（当前陪伴标记 + 收藏宠物）
   - 点击某只宠物 → 切换为 `active: true`，其他宠物 `active: false`
   - 每只宠物显示名字 + 类型图标（用 PET_TYPES 配置的 emoji）+ 阶段名称

**验收标准：** 点击喂食，弹出食物选择，选饼干后星币 -3，饱食度 +30，经验 +2，宠物冒出鼓励气泡。点击玩耍，随机触发一种动画，心情增加。切换宠物功能正常。

---

## Task 5: 任务中心 - 任务列表展示

**预计时间：** 15-20 分钟（2 个文件，任务卡片+tab切换+宠物陪伴计时+结算弹窗+挑战面板，UI 最复杂）
**可断点：** ✅ 完成后 #tasks 页面能看到任务列表

**文件：**
- 创建: `monster-pet/css/task.css`
- 创建: `monster-pet/js/task-list.js`

**实现内容：**
1. 任务中心页面结构（动态渲染到 `#page-tasks` 容器）：
   - 顶部：🏆 挑战入口按钮 + 添加任务按钮（大 + 号）
   - 中部：三个 tab（待完成 / 进行中 / 已完成）+ 分类筛选横向滚动（全部/📚校内/🏫校外/🎨兴趣/📖阅读）
   - 任务卡片列表
2. `task-list.js`：
   - `renderTasks(filter, category)` — 根据 filter + category 渲染任务卡片
   - 任务卡片内容：左侧分类色条（蓝/紫/橙/绿）+ 标题 + 子任务进度条（如有）+ 截止时间倒计时 + 星币奖励徽章
   - **⏱️ 计时任务**（跳绳等）：卡片内嵌宠物陪伴计时区域
   - **无子任务的任务**（大多数默认模板）：卡片显示"开始 ▶"按钮 → 变为"完成 ✓"按钮
   - **有子任务的任务**：点击"开始 ▶"→ 展开子任务列表，可逐个打勾
   - **active 状态宠物陪伴计时**：卡片右侧显示迷你宠物头像 + 循环小动画（看书→打盹→伸懒腰→玩毛线球），宠物气泡台词每 5 分钟切换，时间小字显示在下方
   - **完成结算弹窗**：全部完成后弹出卡片"🎉 用了 XX 分 XX 秒！"，显示星币明细（基础 + 早鸟🌅 + 连击🔥 = 总计），宠物欢呼冒爱心特效
   - 卡片右上角 ⋮ 按钮点击展开下拉：编辑 / 删除（删除需二次确认）
   - 即将到期（<1小时）卡片边框标橙 + 🔔 图标
   - 已过期卡片变灰 + "已过期" 标签
   - 全部子任务完成 → 自动标记任务完成 → 调用 `store.completeTask()` → Toast "+N 星币 +M 经验"
   - 无子任务的任务点击"完成 ✓"→ 直接完成
3. 分类筛选：点击分类图标过滤任务，"全部"显示所有分类
4. 🏆 挑战入口：点击弹出挑战列表面板（可接受/已完成挑战）
5. 空状态：显示"还没有任务哦" + 简单 SVG 插画
6. 任务状态流转：pending → active（点击展开/开始）→ completed（完成）

**验收标准：** 切到任务中心，看到示例任务，左侧色条按分类区分。语文作业、数学作业等无子任务任务直接显示"开始 ▶"按钮。点击"开始"后卡片显示宠物陪伴计时动画+时间小字，按钮变为"完成 ✓"。完成任务后弹出结算弹窗，显示获得星币数和耗时，宠物欢呼特效。点击分类筛选正确过滤。

---

## Task 6: 任务中心 - AI 文字解析 + 创建 + 模板

**预计时间：** 12-18 分钟（4 个文件，创建面板+本地解析+AI API+模板库，功能点多）
**可断点：** ✅ 完成后可实际输入文字或选模板创建任务

**文件：**
- 创建: `monster-pet/js/task-parser.js`
- 创建: `monster-pet/js/task-ai.js`
- 创建: `monster-pet/js/task-creator.js`
- 创建: `monster-pet/js/task-templates.js`

**实现内容：**
1. 点击 + 按钮弹出创建面板（底部弹出 sheet，半透明遮罩）
2. **Step 1：选择分类** — 4 个分类图标卡片横排（📚校内/🏫校外/🎨兴趣/📖阅读）
3. **Step 2：输入任务或选模板**
   - 大输入框："描述你的任务..."
   - 选好分类后，输入框下方显示**两排模板**：
     - **默认模板**（系统预设 7 个，见设计文档模板库）
     - **我的模板**（用户保存的自定义模板，带"我的"标签，最多 20 个）
   - 点击模板 → 自动填入标题和子任务
4. **确认卡片**：
   - 标题（可编辑）+ 分类标签
   - 子任务列表（可增删）
   - 截止时间（datetime-local）
   - 重复规则（每天/每周/一次）
   - 星币奖励（数字输入 1-20）
   - **📌 保存为模板** 按钮 → 弹出命名输入框 → 保存到 `store.myTemplates`
5. `task-parser.js` 本地规则解析（输入框文字）：
   - 正则匹配时间关键词 → repeat / deadline
   - 正则匹配分类关键词（"语文""数学""英语""钢琴""阅读"）→ 自动选择 category
   - **拆分子任务规则**：连接词拆分 / 单一动作不拆 / 上限 3 个（从原来的 5 个降低）
   - 返回 `{title, subtasks, deadline, repeat, category, suggestedCoins, confidence}`
6. `task-templates.js` 模板数据（从设计文档模板库提取，按 category 分组，包含默认 8 个模板）
7. `task-creator.js` 创建流程：
   - 确认 → 写入 store → 刷新列表 → 关闭 sheet → Toast "任务创建成功"

**验收标准：** 选"📚校内"分类 → 默认模板显示"语文作业""数学作业""英语作业"。选"🎨兴趣"分类 → 默认模板显示"钢琴练习"。选"🏫校外"分类 → 默认模板显示"圆圆老师（数学）""Daniel 作业（英语）"。创建一个任务后点"保存为模板"，下次创建时"我的模板"区域显示该模板。输入"每天练琴30分钟"→ 自动识别为🎨兴趣分类。

---

## Task 7: 任务中心 - 定时提醒 + 重复任务刷新

**预计时间：** 6-10 分钟（1 个文件，定时器+页面可见性监听，逻辑独立且较简单）
**可断点：** ✅ 完成后到时间的任务自动弹提醒，每日任务自动刷新

**文件：**
- 创建: `monster-pet/js/reminder.js`

**实现内容：**
1. `reminder.js` 定时检查器：
   - `startReminderCheck()` — 每 30 秒扫描一次 pending/active 任务
   - 距截止时间 < 30 分钟 → Toast 提醒："主人，[任务名]快到时间了！"（宠物气泡风格）
   - 距截止时间 < 5 分钟 → Toast + 任务卡片标红
   - 已过期未完成 → 调用 `store.set('tasks[i].status', 'expired')` + Toast
2. **重复任务刷新**：
   - 每次页面可见时（`visibilitychange`）检查是否需要刷新
   - `daily` 任务：如果 `lastResetDate !== 今天`，重置子任务状态为 false，status 改为 pending，更新 lastResetDate
   - `weekly` 任务：如果 `lastResetDate !== 本周一`，同样重置
   - 前一天未完成的日常任务标记为 expired
3. 使用 `#toast-container` 通用 Toast
4. 同一任务不重复提醒（写入 `store.remindedTasks`，每日清空）
5. 页面不可见时暂停检查，可见时立即补查一次

**验收标准：** 设置一个 2 分钟后到期的任务，等待后看到 Toast 提醒弹出。改系统日期到第二天，日常任务自动重置为待完成。

---

## Task 7.5: 周计划管理 + 每日自动生成

**预计时间：** 12-18 分钟（1 个文件，7 列周计划 UI+模板选择器+自动生成+早鸟配置，交互多）
**可断点：** ✅ 完成后家长面板可配置周计划，每天自动生成对应任务

**文件：**
- 创建: `monster-pet/js/weekly-plan.js`

**实现内容：**
1. **周计划数据管理**：
   - `getWeeklyPlan()` — 读取 `store.weeklyPlan`
   - `setDayPlan(dayIndex, taskList)` — 设置某天的任务列表
   - `addToDayPlan(dayIndex, templateItem)` — 向某天添加一个任务模板
   - `removeFromDayPlan(dayIndex, index)` — 从某天删除一个任务
   - `copyDayPlan(fromDay, toDay)` — 复制某天的计划到另一天
2. **每日自动生成任务**（`generateDailyTasks()`）：
   - 每次页面可见时（`visibilitychange`）检查：今天是否已生成过周计划任务
   - 获取今天是周几 `new Date().getDay()`（0=周日，1=周一...）
   - 从 `store.weeklyPlan[today]` 读取今天的模板列表
   - 对每个模板项：检查今天是否已有同标题+同分类的任务，没有则创建新任务实例
   - 新任务默认 status: 'pending'，记录 `source: 'weeklyPlan'`（标记来源）
   - 与 T7 的重复任务刷新机制协同工作
3. **周计划页面渲染**（在家长面板的"📅周计划"tab 中）：
   - 横向 7 列卡片（周一~周日），当前天高亮
   - 每列下方显示任务列表（模板名称 + 💰星币 + ⏱️计时标记 + 🗑️删除）
   - 列底部"＋添加"按钮 → 弹出模板选择器（默认模板 + 我的模板）
   - 每列顶部"📋复制"按钮 → 选择目标天 → 复制该天任务到目标天
   - 拖拽排序（简单的上下拖拽，或用上/下箭头按钮）
4. **模板选择器**（底部 sheet）：
   - 两排：默认模板（系统 7 个）+ 我的模板
   - 每个模板显示：名称 + 分类色条 + 默认星币
   - 点击即添加到当前选中的天
5. **早鸟时间**（在周计划每天列顶部配置）：
   - 每天独立的 🌅 图标 + toggle 开关
   - 点击展开设置时间（input type="time"），范围限制 5:00-9:00
   - 关闭后该天不触发早鸟奖励
   - 配置存入 `store.earlyBirdConfig[dayIndex]`

**验收标准：** 家长面板中配置周一计划（语文5💰 + Daniel作业5💰），设置周一早鸟时间为 7:00。切到周一日期后刷新页面，任务中心自动出现这两个任务。在 6:50 点击"开始"任务，完成后看到 🌅 早鸟 +3 星币。结算弹窗显示明细（含 🔥 连击加成）。在周计划页面可独立设置每天不同的早鸟时间和开关。

---

## Task 8: 星币商店

**预计时间：** 10-15 分钟（2 个文件，商店页面+盲盒随机购买+食物/装饰逻辑）
**可断点：** ✅ 完成后 #shop 页面可浏览和购买

**文件：**
- 创建: `monster-pet/css/shop.css`
- 创建: `monster-pet/js/shop.js`

**商品列表：**
| 分类 | id | 商品 | 价格 | 效果 |
|------|-----|------|------|------|
| 宠物蛋 | egg_mystery | 🥚 神秘宠物蛋 | 300 | 随机获得一种宠物蛋（6种等概率） |
| 食物 | food_bone | 🍖 超级肉骨头 | 10 | hunger +50 |
| 食物 | food_cake | 🍰 梦幻蛋糕 | 15 | 全属性 +20 |
| 食物 | food_candy | 🍬 能量糖果 | 5 | energy +30 |
| 食物 | food_shrimp | 🦐 小虾米 | 8 | hunger +40 |
| 食物 | food_veg | 🌿 鲜嫩蔬菜 | 6 | hunger +35 |
| 装饰 | deco_crown | 🎩 皇冠 | 100 | pet.accessories.push('crown') |
| 装饰 | deco_scarf | 🧣 围巾 | 80 | pet.accessories.push('scarf') |
| 装饰 | deco_bow | 🎀 蝴蝶结 | 60 | pet.accessories.push('bow') |

**食物偏好机制**（额外 +5 经验）：
| 宠物 | 可吃食物 | 偏好食物 |
|------|---------|---------|
| 小猫咪 cat | 小饼干、肉骨头、蛋糕、糖果 | 🍰 梦幻蛋糕 |
| 小孔雀鱼 fish | 小饼干、小虾米 | 🦐 小虾米 |
| 小乌龟 turtle | 小饼干、肉骨头、鲜嫩蔬菜 | 🌿 鲜嫩蔬菜 |
| 露娜 luna | 小饼干、肉骨头、蛋糕 | 🍖 超级肉骨头 |
| 小精灵 fairy | 小饼干、蛋糕、糖果 | 🍬 能量糖果 |
| 小章鱼 octopus | 小饼干、糖果、小虾米 | 🦐 小虾米 |

**实现内容：**
1. 商店页面（动态渲染到 `#page-shop`）：
   - 顶部：星币余额展示（💰 50）
   - 分类 tab（宠物蛋 / 食物 / 装饰）
   - 商品网格（3 列）
2. 商品卡片：图标 + 名称 + 价格 + 购买按钮
3. 购买逻辑：
   - 调用 `store.buyItem(itemId)`
   - 星币充足 → 扣款 + Toast 成功提示 + 效果生效
   - 星币不足 → 按钮抖动动画 + Toast "星币不够哦，快去完成任务吧！"
   - 装饰品已拥有 → 按钮变灰 + "已拥有"
   - 宠物蛋可重复购买（不同类型）
4. 宠物蛋购买后：随机从 6 种宠物中选一种（等概率），新增宠物（stage:0, type:对应类型, active:false），播放开蛋动画，Toast "🎉 获得了一只 [宠物名] 蛋！去宠物乐园看看吧~"
5. 食物购买即生效：直接修改当前宠物状态值
6. 装饰品购买后写入 `store.shopItems`，T3 宠物渲染读取并绘制

**验收标准：** 浏览商店，购买能量糖果（5 星币），宠物活力增加 30。星币不足时按钮抖动提示。购买宠物蛋后切到宠物乐园可看到新宠物。

---

## Task 9: 家长面板

**预计时间：** 15-20 分钟（2 个文件，密码锁+4 个 tab+周计划+积分管理+系统设置，功能最全面）
**可断点：** ✅ 完成后 #parent 页面可管理

**文件：**
- 创建: `monster-pet/css/parent.css`
- 创建: `monster-pet/js/parent-panel.js`

**实现内容：**
1. 密码锁界面（覆盖在家长面板上方）：
   - 4 个圆形输入框，数字键盘（0-9 + 删除）
   - 默认密码 0000，错误时输入框抖动 + 红色提示"密码错误"
   - 解锁后 5 分钟内不需要再输密码（检查 `store.parentUnlockedAt`，5 分钟内跳过密码）
2. 面板内容（动态渲染到 `#page-parent`）：
   - **今日总览卡片**：今日完成任务数 / 赚取星币 / 连续打卡天数 / 宠物名字和状态 / 今日早鸟任务数
   - **功能 tab**：任务管理 / 📅周计划 / 积分管理 / 系统设置
3. 任务管理：
   - 任务列表（只读展示标题+状态）+ 每个任务旁删除按钮
   - "添加任务"按钮（复用 T6 的创建面板，但 creator 标记为 'parent'）
   - 每个任务旁可手动设星币（1-20 数字输入框）
   - 启用/禁用任务（toggle 开关），禁用后不显示在孩子的任务列表中
4. **📅 周计划管理**（调用 `weekly-plan.js`）：
   - 横向 7 列（周一~周日），当前天高亮
   - 每列展示任务 + 💰 + ⏱️ + 删除按钮
   - 每列顶部 🌅 早鸟时间配置（toggle + 时间选择器）
   - 底部"＋添加"→ 弹出模板选择器（默认+我的模板）
   - "📋复制到其他天"功能
5. **自定义模板管理**：
   - 查看"我的模板"列表（显示名称、分类、星币）
   - 编辑/删除自定义模板
   - 重命名模板
6. 积分管理：
   - 当前星币余额大字展示
   - +/- 按钮 + 数量输入（1-100），手动加减星币
   - 最近完成记录（从 completedHistory 取最近 10 条，显示标题、星币、耗时、🌅标记）
   - 本周任务平均耗时统计（简单列表展示）
7. 系统设置：
   - 修改密码：旧密码输入 + 新密码输入 × 2 + 确认按钮
   - 衰减速度：三个按钮单选（宽松/正常/严格），实时生效
   - 重置数据：红色按钮，点击弹出二次确认弹窗（"确定要重置所有数据吗？此操作不可撤销！"），确认后 `store.reset()` + 刷新页面

**验收标准：** 输入密码 0000 进入面板，看到今日总览（含早鸟数）。可配置周计划：在周一添加"语文作业"+ "Daniel作业"，复制到周二，设置周一早鸟时间为 7:00、周六关闭早鸟。可手动加减星币。可修改密码。可禁用任务。可查看和编辑自定义模板。最近完成记录显示耗时和🌅标记。重置数据有二次确认。

---

## Task 10: 动画效果 + 打磨

**预计时间：** 15-20 分钟（跨文件打磨，12 个动画点+🔥加火力视觉特效）
**可断点：** ✅ 每个动画独立，可逐个添加

**实现内容：**
1. **宠物进化动画**（经验值满 → 2 秒动画：缩放 1→1.3→1 + 粒子特效 + 阶段名闪现"进化为 少年！"）
2. **任务完成 Toast** 带 ⭐ 图标 + 星币飘字动画
3. **任务完成宠物欢呼**（冒爱心 + 星星✨ 特效 1.5 秒）
4. **宠物陪伴计时动画**（active 状态卡片上的迷你宠物循环动画：看书→打盹→伸懒腰→玩毛线球，CSS/Canvas 实现）
5. **星币变化**时导航栏数字弹跳（scale 动画 1.2x → 1x）
6. **商店购买成功**按钮变绿打勾 1 秒
7. **页面切换**过渡优化（slide + fade，150ms）
8. **Toast** 出现/消失动画（从底部滑入 + 3 秒后渐隐）
9. **空状态**小怪兽 SVG 左右摇摆动画
10. **确认弹窗**样式统一（圆角 + 遮罩 + 弹性缩放弹出）
11. **生病状态**宠物颤抖 CSS 动画 + 生病图标闪烁
12. **首次引导**步骤切换滑动动画

**验收标准：** 完成一个任务，看到 Toast 星星 + 星币数字弹跳 + 宠物开心跳跃。商店购买有反馈动画。页面切换流畅。进化时播放粒子特效。

---

## 执行策略

每个 Task 独立可运行，完成后：
1. 用 `preview_url` 预览当前效果
2. 用户确认 OK → 进入下一个 Task
3. 中断后，下一个会话从断点的下一个 Task 继续

**依赖关系：**
```
T1 骨架 → T2 数据层 → T3 宠物渲染 → T4 宠物互动
                   → T5 任务列表 → T6 AI解析+模板 → T7 提醒 → T7.5 周计划
                   → T8 商店
                   → T9 家长面板（依赖 T7.5 周计划）
        T3+T4+T5+T6+T7+T7.5+T8+T9 全部完成 → T10 打磨
```

**并行可能：** T4 和 T5 可以并行（都依赖 T2），T7.5 和 T8 可以并行（T7.5 依赖 T6，T8 只依赖 T2）。

---

## ⏱️ 时间估算总览

| Task | 内容 | 文件数 | 预计时间 | 复杂度 |
|------|------|--------|---------|--------|
| T1 | 项目骨架 + 样式 + 导航 + 引导 + PWA | 6 | 10-15 min | ⭐⭐⭐ |
| T2 | 数据层 Store + 首次引导逻辑 | 2 | 12-18 min | ⭐⭐⭐ |
| **T3a** | **宠物乐园 - 框架 + 猫咪绘制 + 状态** | 2 | 10-15 min | ⭐⭐⭐ |
| **T3b** | **宠物乐园 - 其余 5 种宠物绘制** | 1(改) | 12-18 min | ⭐⭐⭐⭐ |
| T4 | 宠物乐园 - 互动 + 气泡 + 切换 | 1 | 10-15 min | ⭐⭐⭐ |
| T5 | 任务中心 - 任务列表展示 | 2 | 15-20 min | ⭐⭐⭐⭐ |
| T6 | 任务中心 - AI 解析 + 创建 + 模板 | 4 | 12-18 min | ⭐⭐⭐⭐ |
| T7 | 任务中心 - 定时提醒 + 刷新 | 1 | 6-10 min | ⭐⭐ |
| T7.5 | 周计划管理 + 每日自动生成 | 1 | 12-18 min | ⭐⭐⭐ |
| T8 | 星币商店 | 2 | 10-15 min | ⭐⭐⭐ |
| T9 | 家长面板 | 2 | 15-20 min | ⭐⭐⭐⭐ |
| T10 | 动画效果 + 打磨 | 跨文件 | 15-20 min | ⭐⭐⭐⭐ |
| | **合计** | **24 个文件** | **~129-184 min** | |

> **关键路径**（串行无并行）：T1→T2→T3a→T3b→T4→T5→T6→T7→T7.5→T8→T9→T10 ≈ 2-3 小时
>
> **拆分原因**：原 T3 需要在单个文件中画 6 种宠物×4 阶段=24 种形态，是最大瓶颈。拆成 T3a（框架+猫咪验证管线）和 T3b（补全其余 5 种），T3a 完成即可确认渲染管线没问题。
>
> **建议**：每个 Task 完成后停下来预览确认，避免累积错误。T3a 是关键卡点——跑通后 T3b 只是重复劳动。
