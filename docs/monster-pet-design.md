# 小怪兽养成记 — 完整项目设计文档

> 版本：v2.0  
> 最后更新：2026-04-25  
> 状态：持续维护中，编码前以此为准

---

## 一、项目概述

面向 8-12 岁儿童的任务管理系统 + 电子宠物养成 SPA 应用。

### 技术形态
- 纯前端 SPA（HTML/CSS/Vanilla JS），零外部依赖
- 数据存 localStorage，支持 PWA 离线安装
- 部署：GitHub Pages（https://doraemoncc.github.io/monster-pet/）
- 断点：768px / 820px

### 核心驱动循环

```
完成任务 → 获得星币 + 宠物经验 → 喂养/互动宠物 → 宠物成长进化 → 解锁新宠物
    ↑                                                          |
    └──────── 被宠物的可爱和成长感激励去做更多任务 ←──────────────┘
```

### 双货币设计
- **星币**：完成任务获得，用于商店消费（食物、装饰品）
- **经验值**：完成任务获得，驱动宠物成长进化（不可消费）

---

## 二、数据模型（localStorage）

```js
{
  user: {
    name: '小探险家',
    coins: 50,
    streak: 0,
    lastActiveDate: null,
  },
  pets: [
    {
      id: 'pet_1',
      name: '小团子',
      type: 'cat',       // cat/fish/turtle/luna/fairy/octopus
      stage: 1,          // 0蛋 1幼崽 2少年 3成年
      exp: 0,
      hunger: 80,
      mood: 70,
      energy: 90,
      sick: false,
      active: true,
      accessories: [],
      masterLevel: 0,
      createdAt: '...'
    }
  ],
  tasks: [],              // 周计划自动生成，家长添加任务也在此
  myTemplates: [],
  weeklyPlan: {
    0: [],  // 周日
    1: [...], 2: [...], 3: [...], 4: [...], 5: [...], 6: [...]
    // 每项：{ templateId, coins, isTimed }
  },
  earlyBirdConfig: {
    0: { enabled: true, time: '08:30' },
    1: { enabled: true, time: '06:30' },
    2: { enabled: true, time: '06:30' },
    3: { enabled: true, time: '06:30' },
    4: { enabled: true, time: '06:30' },
    5: { enabled: true, time: '06:30' },
    6: { enabled: false, time: null }
  },
  challenges: [
    { id, title, description, bonusCoins, accepted, completed, completedAt, weeklyReset }
  ],
  shopItems: [],
  parentPassword: '0000',
  onboardingDone: false,
  remindedTasks: [],
  settings: {
    decaySpeed: 'normal',  // strict/normal/relaxed
    aiApiKey: ''
  },
  completedHistory: [],    // [{ taskId, title, coins, duration, isEarlyBird, completedAt }]

  // ——— v2 新增字段 ———
  dailyUnlock: {
    date: null,            // YYYY-MM-DD，最近一次完成全部任务的日期
    unlocked: false        // 今天是否已完成任务解锁商城/宠物乐园
  },
  dailyInteractions: {
    date: null,            // YYYY-MM-DD，当前日期（每天重置）
    feedUsed: false,       // 今天是否已喂食
    playUsed: false,       // 今天是否已玩耍
    bonusLeft: 0           // 今天剩余额外互动次数（完成挑战/附加任务获得）
  }
}
```

### Task 数据结构
```js
{
  id: 'task_xxx',
  title: '语文作业',
  category: 'school',   // school/tutoring/hobby/reading/other
  subtasks: [{ id, text, done }],
  deadline: null,
  repeat: 'daily',      // daily/weekly/once
  coins: 5,
  status: 'pending',    // pending → active → completed
  creator: 'plan',      // plan/parent/challenge
  isChallenge: false,   // 是否挑战任务
  enabled: true,
  isTimed: false,
  startedAt: null,
  completedAt: null,
  duration: null,
  isEarlyBird: false,
  coinsEarned: null,    // { total, bonus: [{ icon, label, value }] }
  createdAt: '...',
  lastResetDate: null,
  _templateId: 'default_school_chinese'
}
```

---

## 三、模块详情

### 3.1 宠物乐园 🐾

#### 宠物种类（6种）
| 宠物 | type | 性格 |
|------|------|------|
| 🐱 小猫咪 | cat | 慵懒傲娇 |
| 🐟 小孔雀鱼 | fish | 活泼好奇 |
| 🐢 小乌龟 | turtle | 稳重慢吞吞 |
| 🐉 露娜 | luna | 勇敢高贵（灵感：光煞 Light Fury） |
| 🧚 小精灵 | fairy | 温柔善良 |
| 🐙 小章鱼 | octopus | 聪明调皮 |

首次默认小猫咪幼崽；后续通过商店购买神秘宠物蛋（300星币）随机孵化。

#### 成长系统
| 阶段 | 累计经验 | 形态 |
|------|---------|------|
| 🥚 蛋 | 0 | 椭圆+斑点+晃动 |
| 🐣 幼崽 | 50/200（v1/当前） | 圆脸+大眼+呼吸 |
| 🐥 少年 | 200/600 | 特征更明显 |
| 🦋 成年 | 500/1500 | 完整+光效 |

成年后：大师等级（每500经验升1级）

#### 状态系统
| 状态 | 图标 | 衰减（每6小时） |
|------|------|--------------|
| 饱食度 | 🍖 | 宽松-3/正常-5/严格-8 |
| 心情值 | 💛 | 同上 |
| 活力值 | ⚡ | 同上 |

- 所有属性 > 60 → 活泼跳跃
- 任一属性 20-60 → 打哈欠🥱（可爱，非可怜）
- 任一属性 < 20 → 抱枕头打瞌睡😴
- 任一属性降到 0 → 生病（灰色+红十字），完成任务恢复，**不设死亡机制**

#### 宠物互动（每类每天各限1次）

> **v2 新规则**：每天喂食和玩耍各限一次，完成挑战任务或附加任务可额外奖励互动机会。

**喂食**（消耗星币，每天1次+bonus）：
| 食物 | 消耗 | 效果 | 可喂宠物 | 偏好宠物 |
|------|------|------|---------|---------|
| 🍪 小饼干 | 3 | 饱食+30 | 全部 | — |
| 🍖 超级肉骨头 | 10 | 饱食+50 | 猫咪/乌龟/露娜 | 露娜 |
| 🍰 梦幻蛋糕 | 15 | 全属性+20 | 猫咪/精灵/露娜 | 猫咪 |
| 🍬 能量糖果 | 5 | 活力+30 | 猫咪/章鱼/精灵 | 精灵 |
| 🦐 小虾米 | 8 | 饱食+40 | 金鱼/章鱼 | 金鱼/章鱼 |
| 🌿 鲜嫩蔬菜 | 6 | 饱食+35 | 乌龟 | 乌龟 |

偏好食物额外 +5 经验。

**玩耍**（每天1次+bonus）：
| 互动 | 变化 |
|------|------|
| 🎾 扔球球 | 心情+25，活力-10 |
| 🫧 吹泡泡 | 心情+20，活力-5 |
| 🎵 音乐时间 | 心情+15，活力-15 |

**已用完时的提示**：「今天已经[喂食/玩耍]过啦～完成挑战或附加任务可以获得额外机会哦！」

**额外互动奖励触发**：完成挑战任务或附加任务时，`dailyInteractions.bonusLeft += 1`，同时弹出 toast：「🎉 获得一次额外宠物互动机会！」

#### 宠物乐园访问限制（v2新规）
- 每天第一次打开时锁定，完成当天所有任务后解锁
- 提示：「今天的任务还没完成哦～先完成任务再来和[宠物名]玩吧！」
- 解锁逻辑与商城共用 `dailyUnlock` 字段

#### 互动后气泡语
- 鼓励语（随机）
- 任务提醒（有未完成任务时 50%）
- 打卡鼓励（连续打卡>0 时 20%）
- 偏好食物反馈

#### 页面布局
顶部：宠物名字+切换按钮+经验进度条  
中间：Canvas画布（300×300）  
下方：三个圆形状态环（饱食/心情/活力）  
底部：喂食+玩耍按钮（按钮显示今日是否已用）

---

### 3.2 任务中心 📋

#### 任务分类
| 分类 | emoji | 颜色 | category |
|------|-------|------|---------|
| 校内作业 | 📚 | 蓝 | school |
| 校外课程 | 🏫 | 紫 | tutoring |
| 兴趣班 | 🎨 | 橙 | hobby |
| 课外阅读 | 📖 | 绿 | reading |
| 其他 | 📝 | 灰 | other |

#### 页面布局（v2）
- 日期轴（周一～周日，**无翻页按钮**，点击日期切换）
- 情感引导语（英文日期行 + 中文鼓励语）
- 左：迷你宠物面板；右：任务卡片区
- 分类筛选（全部/各分类）
- 任务卡片列表
- **底部操作栏已移除**（「🏆挑战」和「➕添加任务」移到家长面板）

#### 日期切换规则（v2）
- **删除** `‹` `›` 翻页按钮
- **删除** 日期标签区域（今天/昨天/回到今天）
- 日期轴始终显示当前周（周一～周日），点击切换

#### 任务状态流转
`pending` → 点击"开始▶" → `active`（记录startedAt）→ 点击"完成✓"或全部子任务完成 → `completed`（发放星币+经验）

#### 完成结算弹窗
「🎉 用了XX分XX秒！获得N星币」，显示明细（基础+早鸟🌅+连击🔥）

#### 宠物陪伴计时
active 状态卡片嵌入迷你宠物：
- 0-5分钟：看书📖
- 5-15分钟：打盹💤
- 15-25分钟：玩毛线球🧶
- 25分钟+：打哈欠🥱
- 全屏计时弹窗（点击开始或卡片内⛶按钮触发）

#### 星币奖励规则
| 类型 | 基础 | 加成 |
|------|------|------|
| 日常任务 | 家长设定 | 连续打卡 +1/天（上限+10，中断🔥归零） |
| 一次性任务 | 家长设定 | 提前完成 ×1.5 |
| 🌅 早鸟 | +3 | 早鸟时间前开始 |
| 子任务 | — | +3经验/个 |

#### 挑战任务（5个，每周一重置）
| 挑战 | 奖励 |
|------|------|
| ⚡ 连续3天打卡 | +20星币 |
| 📚 超级阅读王 | +30星币 |
| 🔤 英语小达人 | +30星币 |
| 🏃 运动小健将 | +25星币 |
| ✍️ 作文小作家 | +20星币 |

> **v2**：挑战入口**已从任务中心移除**，迁移到家长面板「🏆 挑战」tab。

---

### 3.3 星币商店 🏪

#### 门卫规则（v2重做）
> 每天第一次打开时锁定商城；完成当天所有任务后解锁。
> 提示：「今天的任务还没完成哦～先去完成任务再来吧！」

**解锁机制**：`completeTask()` 后检查今天是否还有 `pending/active` 任务，若为0则设置 `dailyUnlock = { date: today, unlocked: true }` 并弹庆祝 toast。每天重置时 `unlocked = false`。

#### 商品列表
| 分类 | 商品 | 价格 | 效果 |
|------|------|------|------|
| 宠物蛋 | 🥚 神秘宠物蛋 | 300 | 随机孵化宠物 |
| 食物 | 🍖 超级肉骨头 | 10 | 饱食+50 |
| 食物 | 🍰 梦幻蛋糕 | 15 | 全属性+20 |
| 食物 | 🍬 能量糖果 | 5 | 活力+30 |
| 食物 | 🦐 小虾米 | 8 | 饱食+40 |
| 食物 | 🌿 鲜嫩蔬菜 | 6 | 饱食+35 |
| 装饰 | 🎩 皇冠 | 100 | 宠物戴皇冠 |
| 装饰 | 🧣 围巾 | 80 | 宠物戴围巾 |
| 装饰 | 🎀 蝴蝶结 | 60 | 宠物戴蝴蝶结 |

---

### 3.4 家长面板 👨‍👩‍👧

密码锁（默认0000），**每次离开页面自动锁定，回来必须重新输入**（已取消5分钟免密）。

#### Tab 布局（v2，共5个）

| Tab | 内容 |
|-----|------|
| 📋 任务管理 | 任务模板库 + 添加附加任务 |
| 📅 周计划 | 7天可编辑周计划 + 早鸟配置 |
| 🏆 挑战 | 挑战任务管理 |
| 🌅 早鸟 | 每天早鸟时间配置 |
| 💰 积分管理 | 星币手动加减 + 完成记录 |

> 注：原「💾 数据」tab 保留（备份/导出），「系统设置」tab 保留（密码/重置/衰减速度）。

#### Tab 1：任务管理（原「任务模板」+「添加任务」合并）

**区块一：任务模板库**
- 显示所有模板（默认8个 + 自定义模板）
- 每个模板均显示 ✏️ 编辑 按钮
- 自定义模板额外显示 🗑️ 删除按钮
- 「＋ 新建模板」按钮（右上角）
- 编辑规则：
  - 自定义模板：直接更新 `myTemplates` 中对应项
  - 默认模板：保存为 `myTemplates` 中的 override 版（`id: 'override_<原id>'`，`isOverride: true`），`findTemplate()` 优先返回 override 版本

**编辑弹窗字段**：任务名称、分类、星币奖励、重复方式、预估时间

**区块二：添加附加任务**（原任务中心「➕添加任务」）
- 家长直接为孩子添加一次性临时任务
- 字段：任务名称、分类、星币、（可选）截止时间
- 保存后立即出现在今天的任务列表中
- `creator: 'parent'`，`repeat: 'once'`
- 完成此类任务可触发额外互动奖励（见 §3.1）

#### Tab 2：周计划

- 横向7天，每天支持添加/删除模板，点击💰星币可内联编辑
- 每条任务有 ⏱️ 计时 toggle
- 「＋ 添加」按钮 → 模板选择器（含搜索）
- **立即生效（v2新规）**：`addPlanItem()` / `removePlanItem()` 后，强制重新生成今天任务（`forceToday` 参数），只补充缺少的任务，不删除已完成任务

#### Tab 3：挑战（v2新增）

原任务中心的「🏆挑战」入口迁移到此处：
- 显示5个挑战任务，各有进度/状态
- 可查看已完成记录

#### Tab 4：早鸟设置

- 每天独立配置：开关 + 时间（5:00-9:00）
- 关闭后该天无早鸟奖励

#### Tab 5：积分管理

- 当前星币余额
- 手动加减（+/- 按钮 + 数量输入）
- 最近完成记录（10条，含耗时/早鸟标记）
- **🗑️ 测试数据管理**（底部危险区域）：
  - 「清除所有任务和完成记录」— 清除 tasks、completedHistory、dailyUnlock、remindedTasks，保留宠物和星币
  - 「重置全部数据（恢复出厂）」— 调用 `store.reset()` 后刷新页面，需二次确认

#### Tab 6：数据

- 导出 JSON 完整备份
- 导出 CSV 打卡报表
- 导入恢复

#### Tab 7：系统设置

- 修改密码
- 衰减速度（宽松/正常/严格）
- 重置数据（二次确认）

---

### 3.5 首次打开引导

1. 「给你的小宠物取个名字吧！」→ 输入名字
2. 展示小猫咪幼崽 → 「完成任务就能让它长大！」
3. 「去任务中心看看有什么要做吧～」

---

## 四、默认模板库

| id | 标题 | 分类 | 星币 | 重复 | 子任务 |
|----|------|------|------|------|--------|
| default_school_chinese | 语文作业 | school | 5 | daily | 无 |
| default_school_math | 数学作业 | school | 5 | daily | 无 |
| default_school_english | 英语作业 | school | 5 | daily | 无 |
| default_tutoring_yuanyuan | 圆圆老师（数学） | tutoring | 8 | weekly | 课后巩固、专属探索 |
| default_tutoring_daniel | Daniel 作业（英语） | tutoring | 5 | daily | Workbook |
| default_hobby_piano | 钢琴练习 | hobby | 5 | daily | 无 |
| default_reading_daily | 每日阅读 | reading | 4 | daily | 无 |
| default_reading_chinese | 中文书阅读 | reading | 4 | daily | 无 |

---

## 五、默认周计划

| 周一 | 周二 | 周三 | 周四 | 周五 | 周六 | 周日 |
|------|------|------|------|------|------|------|
| 语文(5) | 语文(5) | 语文(5) | 语文(5) | 语文(5) | 圆圆老师(8) | 自由 |
| 数学(5) | 数学(5) | 数学(5) | 数学(5) | 数学(5) | 每日阅读(4) | |
| 英语(5) | 英语(5) | 钢琴(5) | 每日阅读(4) | 钢琴(5) | 钢琴(5) | |
| Daniel(5) | Daniel(5) | 每日阅读(4) | | 每日阅读(4) | | |
| 钢琴(5) | 钢琴(5) | | | | | |
| 每日阅读(4) | 每日阅读(4) | | | | | |

---

## 六、关键业务逻辑

### 6.1 商城/宠物乐园门卫（v2）

```
进入 shop 或 pet 页面时：
  → 检查 dailyUnlock.date === today && dailyUnlock.unlocked === true
  → 是：允许进入
  → 否：弹门卫提示，「先去完成任务」

completeTask() 完成后：
  → 检查今天是否还有 pending/active 任务
  → 若为0：
      dailyUnlock = { date: today, unlocked: true }
      showToast('🎉 所有任务完成！商城和宠物乐园已解锁！', 'success')

App 初始化 / _migrate() 时：
  → 若 dailyUnlock.date !== today：dailyUnlock.unlocked = false
```

### 6.2 宠物互动限制（v2）

```
每天重置（_migrate/初始化）：
  → 若 dailyInteractions.date !== today：
      feedUsed = false, playUsed = false, bonusLeft = 0

喂食/玩耍时：
  → 检查对应 Used 字段
  → 未用：标记为已用，执行互动
  → 已用 + bonusLeft > 0：bonusLeft -= 1，执行互动
  → 已用 + bonusLeft === 0：toast 提示「今天已经[互动]过啦，完成挑战或附加任务可获得额外机会」

completeTask() 判断任务类型：
  → isChallenge === true 或 (creator === 'parent' && repeat === 'once')
  → 满足：dailyInteractions.bonusLeft += 1
          showToast('🎉 获得一次额外宠物互动机会！', 'success')
```

### 6.3 周计划立即生效（v2）

```
addPlanItem() / removePlanItem() 后：
  → 调用 checkDailyPlanGeneration(true)  // forceToday=true
  → 跳过 _lastDailyGen 检查
  → 只生成今天新增的、tasks 中不存在的模板任务
  → 不删除已完成任务
```

### 6.4 任务模板 Override（v2）

```
编辑默认模板时：
  → 在 myTemplates 中创建 { id: 'override_<原id>', isOverride: true, ...修改后数据 }

findTemplate(templateId)：
  → 优先查找 myTemplates 中 id === 'override_' + templateId
  → 找到返回 override 版
  → 未找到继续查 myTemplates 原始 id
  → 再找 DEFAULT_TEMPLATES
```

### 6.5 连续打卡（中断即重置，加火力模式）

```
checkStreak()：
  → lastDate === today → return（已打卡）
  → gapDays === 1 → streak += 1
  → gapDays > 1 → streak = 0
  → 更新 lastActiveDate = today
```

---

## 七、文件结构

```
monster-pet/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   ├── base.css         全局样式、CSS变量
│   ├── animations.css   动画
│   ├── pet.css          宠物乐园
│   ├── task.css         任务中心
│   ├── shop.css         星币商店
│   └── parent.css       家长面板
└── js/
    ├── app.js           路由+事件总线+门卫逻辑
    ├── store.js         数据层
    ├── onboarding.js    引导流程
    ├── pet-renderer.js  Canvas宠物绘制
    ├── pet-interaction.js  宠物互动
    ├── task-list.js     任务中心
    ├── task-parser.js   本地规则解析
    ├── task-ai.js       AI解析
    ├── task-creator.js  任务创建流程
    ├── task-templates.js   模板库
    ├── weekly-plan.js   周计划自动生成
    ├── reminder.js      定时提醒
    ├── shop.js          星币商店
    ├── parent-panel.js  家长面板
    └── data-io.js       数据导入导出
```

---

## 八、已完成功能记录

| 功能 | 状态 | 说明 |
|------|------|------|
| 项目骨架+PWA | ✅ | |
| 数据层 Store | ✅ | |
| 宠物 Canvas 绘制（6种） | ✅ | |
| 宠物互动（喂食/玩耍） | ✅ | v2新增每日限制 |
| 任务中心渲染 | ✅ | v2移除翻页按钮 |
| 任务计时器（含全屏弹窗） | ✅ | |
| 早鸟奖励 | ✅ | |
| 连击加成 | ✅ | |
| 星币商店 | ✅ | v2门卫逻辑重做 |
| 家长面板 | ✅ | v2重构为5tab |
| 周计划配置+自动生成 | ✅ | v2立即生效 |
| 模板管理（新建/删除） | ✅ | v2新增编辑 |
| 数据导入导出 | ✅ | |
| 代码审计+iPad适配 | ✅ | |
| 底部导航宽屏修复 | ✅ | |
| 任务重复Bug修复 | ✅ | |
| 任务中心空白修复（scrollTo时序+iPad padding） | ✅ | 见§11.2 |
| 家长面板数据清理功能 | ✅ | 清除任务/重置全部 |

---

## 九、v2 待编码清单（本次更新）

- [ ] **store.js**：新增 `dailyUnlock` + `dailyInteractions` 字段，`_migrate()` 加每日重置逻辑
- [ ] **app.js**：门卫逻辑替换（shop + pet 页面使用 `dailyUnlock`）
- [ ] **task-list.js**：
  - 删除上一天/下一天翻页按钮和日期标签区域
  - 删除底部操作栏（挑战+添加任务按钮）
  - `completeTask()` 后检查触发 `dailyUnlock` + `dailyInteractions.bonusLeft` 奖励
- [ ] **weekly-plan.js**：`checkDailyPlanGeneration(forceToday)` 支持强制重新生成
- [ ] **parent-panel.js**：
  - Tab 从4个调整为5个（任务管理/周计划/🏆挑战/🌅早鸟/💰积分管理，数据和设置保留）
  - 「任务管理」tab 包含：模板编辑+添加附加任务两个区块
  - 「🏆挑战」tab：展示5个挑战任务
  - `addPlanItem()` / `removePlanItem()` 后触发周计划立即生效
- [ ] **task-templates.js**：`findTemplate()` 支持 override 查找
- [ ] **pet-interaction.js**：喂食/玩耍前检查 `dailyInteractions`，已用时处理 bonus

---

## 十、视觉风格

- 温暖手绘风 + 奶油色系背景（`--bg-cream: #FFF8E7`）
- 主色：橙色（`--accent-orange: #FF9A56`）
- 圆润大按钮 + 弹跳微动画
- 整体风格：精美儿童绘本

---

## 十一、CSS 布局规范（防回退）

> ⚠️ **此规范为强制规则**。每次修改 CSS 后必须对照检查，防止已修复 bug 反复出现。

### 11.1 页面 padding 规范

**核心规则：每个页面（`#page-*`）必须显式声明 `padding-top`，不依赖 `.page` 基类的继承。**

原因：各页面用 `padding: Xpx` 简写会覆盖 `.page` 的 `padding-top`，导致安全区域失效。

**每个页面 CSS 必须包含以下完整属性：**
```css
#page-xxx {
  padding: Xpx;
  padding-top: calc(var(--safe-top) + Xpx);   /* ← 必须显式声明！ */
  min-height: calc(100vh - var(--nav-height) - var(--safe-bottom));
  padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + 20px);
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
```

| 页面 | CSS 文件 | padding | padding-top |
|------|---------|---------|------------|
| 宠物乐园 | `pet.css` | `calc(safe-top+20px) 16px calc(nav+safe+20px)` | ✅ 独立声明 |
| 任务中心 | `task.css` | `12px` | `calc(safe-top + 12px)` |
| 星币商店 | `shop.css` | `16px` | `calc(safe-top + 16px)` |
| 家长面板 | `parent.css` | `16px` | `calc(safe-top + 16px)` |

### 11.2 路由时序规范

`navigateTo()` 中的关键顺序不可变更：
1. 门卫检查（如有）
2. 离开事件 `page:leave`
3. 页面 `classList.add('active')`
4. 进入事件 `page:enter`（触发渲染函数）
5. **渲染完成后**再执行 `window.scrollTo(0, 0)`（用 `requestAnimationFrame` 延迟）

> ⚠️ **scrollTo 必须在 page:enter 之后**。iPad Safari 存在时序问题：如果在内容渲染前执行 scrollTo，滚动位置可能不正确，导致页面顶部出现空白。

### 11.2.1 页面切换与 currentPage 一致性

**核心规则：隐藏旧页面时必须兼容 `currentPage === null` 的情况。**

原因：`initRouter()` 将 `currentPage` 设为 `null` 后调用 `navigateTo()`，如果首次导航被门卫拦截（return），`currentPage` 仍为 `null`。之后用户点击其他导航时，`pages[null]` 为 `undefined`，导致旧页面（`page-pet` 的 HTML 初始 `active` class）永远不会被移除，造成多页面内容叠加。

**修复**：`navigateTo` 中隐藏旧页面时：
```javascript
if (currentPage && pages[currentPage]) {
  pages[currentPage].classList.remove('active');
} else {
  // currentPage 为 null 时，清除所有页面的 active
  Object.values(pages).forEach(p => p.classList.remove('active'));
}
```

### 11.3 parentTab 初始值规范

`parent-panel.js` 中 `parentTab` 的初始值必须与 `renderParentContent()` 中第一个 tab 的 `data-tab` 值一致。

| 版本 | 第一个 tab | parentTab 初始值 |
|------|-----------|----------------|
| v2 | `task-mgmt` | `'task-mgmt'` |

**违反此规则会导致家长面板首次进入时内容区空白。**

### 11.4 CSS 修改检查清单

每次修改任何 CSS 文件后，必须检查：

- [ ] 没有用 `padding: Xpx` 简写覆盖掉各页面的 `padding-top`
- [ ] 没有用 `padding-bottom: Xpx` 简写覆盖掉各页面的 `padding-bottom`（尤其是媒体查询中）
- [ ] 没有修改 `.page.active` 的 `display` 属性（必须是 `block`，`#page-pet.active` 是 `flex`）
- [ ] 响应式媒体查询中没有覆盖各页面的 `padding-top` 或 `padding-bottom`
- [ ] `parent-lock` 的 `padding-top` 在平板尺寸下是否过大
- [ ] `body` 没有多余的 `padding-top`/`padding-bottom`（已在 base.css 中移除，各页面独立处理）

---

## 十二、v2.1 待修复 & 新功能设计

> 最后更新：2026-05-17
> 状态：设计完成，待用户确认后执行

---

### 12.1 问题一：宠物装扮系统（购买→装备链路断裂）

#### 现状分析

| 环节 | 现状 | 问题 |
|------|------|------|
| 商店展示 | `shop.js` 有3个装饰品：皇冠🎩100、围巾🧣80、蝴蝶结🎀60 | ✅ 正常 |
| 购买 | `store.buyItem()` 将 deco 记入 `shopItems[]` 数组 | ✅ 正常，但不区分宠物类型 |
| 装备 | **无装备入口**，`pet.accessories` 始终为空数组 | ❌ 链路断裂 |
| 展示 | `drawAccessories()` 绘制在固定坐标 `(cx=150, cy-55)` | ❌ 不区分宠物类型，坐标不匹配 |

**根因**：购买后没有"装备"步骤，装饰品存在 `shopItems[]` 但从未写入 `pet.accessories[]`。

#### 设计方案

**1) 装饰品扩展 & 按宠物类型过滤**

扩展 `SHOP_ITEMS`，新增更多装饰品，每个装饰品增加 `forPets` 字段：

```js
const SHOP_ITEMS = [
  // ... 原有食物/宠物蛋 ...
  { id: 'deco_crown', name: '皇冠', emoji: '🎩', price: 100, category: 'deco',
    forPets: ['cat','luna','fairy'], desc: '头顶金色皇冠' },
  { id: 'deco_scarf', name: '围巾', emoji: '🧣', price: 80, category: 'deco',
    forPets: ['cat','turtle','luna','fairy','octopus'], desc: '温暖的小围巾' },
  { id: 'deco_bow', name: '蝴蝶结', emoji: '🎀', price: 60, category: 'deco',
    forPets: ['cat','fairy'], desc: '可爱的蝴蝶结发饰' },
  { id: 'deco_shell', name: '贝壳项链', emoji: '🐚', price: 70, category: 'deco',
    forPets: ['fish','octopus'], desc: '海洋风贝壳项链' },
  { id: 'deco_flower', name: '小花冠', emoji: '🌸', price: 50, category: 'deco',
    forPets: ['fairy','cat'], desc: '鲜花编织的花冠' },
  { id: 'deco_glasses', name: '墨镜', emoji: '🕶️', price: 90, category: 'deco',
    forPets: ['cat','luna','octopus'], desc: '酷酷的墨镜' },
];
```

**2) 商店展示优化**

- 装饰品卡片根据当前宠物类型，显示"可装备"/"不适合xx"标签
- 已拥有但未装备的装饰品显示"去装备"按钮
- 已装备的装饰品显示"已装备"

**3) 宠物乐园新增"👗 装扮"按钮**

在 `pet-interaction.js` 的互动按钮区（🍎喂食 / 🎮玩耍）旁新增第三个按钮：

```
🍎 喂食    🎮 玩耍    👗 装扮
```

点击后弹出装扮面板（底部弹出抽屉），展示：
- 当前宠物名称 + 类型
- 已拥有且适合该宠物的装饰品列表
- 每个装饰品可切换装备/卸下
- 装备后实时反映到 Canvas 绘制

**4) 装备数据流**

```
点击装备 → store.equipAccessory(petId, accId)
         → 更新 pet.accessories 数组
         → store.set('pets', pets) → emit data:changed
         → pet-renderer.js 自动重绘（drawAccessories 已有）
```

store 新增方法：
```js
equipAccessory(petId, accId) {
  const pets = this.get('pets');
  const pet = pets.find(p => p.id === petId);
  if (!pet) return false;
  // 同类型只允许1个装饰（互斥）—— 或改为允许多个？建议互斥，简化绘制
  pet.accessories = [accId]; // 单件装备模式
  this.set('pets', pets);
  return true;
}

unequipAccessory(petId) {
  const pets = this.get('pets');
  const pet = pets.find(p => p.id === petId);
  if (!pet) return false;
  pet.accessories = [];
  this.set('pets', pets);
  return true;
}
```

**5) drawAccessories 按宠物类型适配坐标**

当前 `drawAccessories` 固定 `cx=150, cy=100`，但各宠物绘制中心不同：

| 宠物 | cx | cy | 头部偏移参考 |
|------|----|----|-------------|
| cat | 150 | 160 | 头顶 cy-55 |
| fish | 150 | 160 | 头顶 cy-50 |
| turtle | 150 | 165 | 头顶 cy-45（壳顶）|
| luna | 150 | 155 | 头顶 cy-60 |
| fairy | 150 | 155 | 头顶 cy-55 |
| octopus | 150 | 155 | 头顶 cy-50 |

改为接收 `petType` 参数，按类型调整绘制坐标。

**6) 家长面板宠物设置同步**

已有的"宠物设置"Tab 中，`accessories` 字段已在编辑范围内（editAll 功能支持），装备状态变更后自动同步。

#### 改动文件清单

| 文件 | 改动 |
|------|------|
| `js/shop.js` | SHOP_ITEMS 扩展 + forPets 字段 + 已拥有装饰品"去装备"按钮 |
| `js/store.js` | `buyItem()` 检查 forPets + 新增 `equipAccessory()` / `unequipAccessory()` |
| `js/pet-interaction.js` | 新增"👗 装扮"按钮 + 装扮面板渲染 + 事件绑定 |
| `js/pet-renderer.js` | `drawAccessories()` 接收 petType，按类型调整坐标 |
| `css/pet.css` | 装扮面板样式（`.dresser-panel` 等） |

---

### 12.2 问题二：任务中心出现重复任务

#### 现状分析

| 漏洞点 | 代码位置 | 问题描述 |
|--------|---------|---------|
| 过滤兜底过于宽泛 | `task-list.js:311` | `if (selKey === todayKey) return true` 导致所有无日期标记的 pending 任务都在今天显示，包括昨天的残留任务 |
| 周计划去重不彻底 | `weekly-plan.js:58-64` | `existingTemplateIds` 用 Set 去重，但如果同一 templateId 在周计划中出现两次（用户手动添加了两个相同模板），会生成两个任务 |
| 手动添加任务无去重 | task-list.js 添加任务逻辑 | 手动添加时无 templateId 去重检查 |

**根因**：

1. **兜底逻辑**：行311 `if (selKey === todayKey) return true` 是个历史遗留兜底，任何没有 `lastResetDate` 和 `createdAt` 的 pending 任务都会出现在今天的任务列表
2. **同模板可重复**：周计划中同一个 templateId 可以出现多次（如两次"语文作业"），每次 reconcile 都会检查 `_templateId` 是否已存在，但存在一个时第二个仍然会生成
3. **_lastDailyGen 检查**：`checkDailyPlanGeneration()` 中 `if (lastGenDate === todayStr) return` 确保一天只生成一次，但 `reconcileTodayTasks()` 在用户编辑周计划时也会被调用，此时可能绕过"一天一次"限制

#### 设计方案

**1) 收紧过滤逻辑**

```js
// 修改 task-list.js 行303-313 的过滤逻辑
let filtered = tasks.filter(t => {
  if (t.status !== 'pending' && t.status !== 'active') return false;
  // 明确匹配日期的任务才显示
  if (t.lastResetDate && t.lastResetDate === selKey) return true;
  if (t.createdAt && t.createdAt.startsWith(selKey)) return true;
  // 删除兜底逻辑，改为：无日期标记的 pending 任务只在今天显示（但需排除重复）
  if (selKey === todayKey && !t.lastResetDate && !t.createdAt) return true;
  return false;
});
```

**2) 周计划去重加强**

在 `reconcileTodayTasks()` 中，将 `existingTemplateIds` 从 Set 改为计数器 Map：

```js
// Step 2 去重加强
const templateCount = {};
tasks
  .filter(t => t.creator === 'plan' && t.lastResetDate === todayStr)
  .forEach(t => {
    const tid = t._templateId;
    templateCount[tid] = (templateCount[tid] || 0) + 1;
  });

planItems.forEach(planItem => {
  const tid = planItem.templateId;
  const existingCount = templateCount[tid] || 0;
  // 同一 templateId 允许出现 N 次（N = 周计划中该模板出现次数）
  if (existingCount >= planItems.filter(p => p.templateId === tid).length) return;
  // ... 生成任务 ...
  templateCount[tid] = existingCount + 1;
});
```

**3) 周计划添加时去重提示**

在 `weekly-plan.js` 的 `addPlanItem()` 中，添加同 templateId 检查：

```js
function addPlanItem(dayIndex, templateId, coins, isTimed) {
  // 检查同 templateId 是否已存在
  const plan = store.get('weeklyPlan') || {};
  const items = plan[dayIndex] || [];
  if (items.some(p => p.templateId === templateId)) {
    showToast('这个任务已经在今天的计划中了', 'warning');
    return false;
  }
  // ... 正常添加 ...
}
```

**4) 已有重复数据清理**

提供一次性清理函数（在家长面板任务管理Tab中加一个"清理重复任务"按钮）：

```js
function cleanDuplicateTasks() {
  const tasks = store.get('tasks') || [];
  const seen = new Set();
  const cleaned = tasks.filter(t => {
    // 非计划任务不去重
    if (t.creator !== 'plan') return true;
    // 同一天同一模板只保留第一个 pending 任务
    const key = `${t._templateId}_${t.lastResetDate}`;
    if (seen.has(key) && t.status === 'pending') return false;
    seen.add(key);
    return true;
  });
  store.set('tasks', cleaned);
}
```

#### 改动文件清单

| 文件 | 改动 |
|------|------|
| `js/task-list.js` | 收紧过滤逻辑（删除宽泛兜底）|
| `js/weekly-plan.js` | reconcileTodayTasks 去重加强 + addPlanItem 去重提示 + cleanDuplicateTasks |
| `js/parent-panel.js` | 任务管理Tab 新增"清理重复"按钮 |

---

### 12.3 问题三：任务中心 ↔ 宠物乐园/星币商城联动感知

#### 现状分析

| 环节 | 现状 | 问题 |
|------|------|------|
| 门卫拦截 | `app.js:70-82` 导航到 shop/pet 时检查 `isDailyUnlocked()` | ✅ 正常工作 |
| 门卫弹窗 | `showShopGuard()` 弹出鼓励弹窗 + "去做任务"按钮 | ✅ 正常工作 |
| 解锁触发 | `store.isTodayAllDone()` 判断 + `setDailyUnlocked()` 标记 | ✅ 正常工作 |
| 导航栏状态 | 始终显示 🐾🐾 / 🏪🏪，无解锁状态变化 | ❌ 无视觉反馈 |
| 完成任务后提示 | 完成最后一个任务时无引导弹窗 | ❌ 缺失 |

**根因**：
1. 导航栏没有响应 `dailyUnlock` 状态变化，用户不知道商城/宠物乐园已解锁
2. 完成最后一个任务后没有即时引导提示

#### 设计方案

**1) 导航栏增加解锁状态指示**

修改底部导航栏 HTML 结构，给 shop 和 pet 的 nav-item 添加状态标记：

```
未解锁状态：图标变灰 + 小锁标记 🔒
已解锁状态：图标正常 + 星星闪烁 ✨
```

实现方式：
- 在 `data:changed` 事件中（或完成任务后）更新导航栏状态
- 新增 `updateNavUnlockState()` 函数

```js
function updateNavUnlockState() {
  const today = new Date().toISOString().slice(0, 10);
  const allDone = store.isTodayAllDone();
  const shopUnlocked = store.isDailyUnlocked('shop');
  const petUnlocked = store.isDailyUnlocked('pet');

  // 如果所有任务完成但还没标记解锁（shouldUnlock 场景）
  if (allDone && !shopUnlocked) store.setDailyUnlocked('shop');
  if (allDone && !petUnlocked) store.setDailyUnlocked('pet');

  const shopNav = document.querySelector('.nav-item[data-page="shop"]');
  const petNav = document.querySelector('.nav-item[data-page="pet"]');

  if (shopNav) {
    const icon = shopNav.querySelector('.nav-icon');
    const label = shopNav.querySelector('.nav-label');
    if (shopUnlocked) {
      icon.textContent = '🏪';
      label.textContent = '星币商店';
      shopNav.classList.remove('nav-locked');
      shopNav.classList.add('nav-unlocked');
    } else {
      icon.textContent = '🔒';
      label.textContent = '星币商店';
      shopNav.classList.add('nav-locked');
      shopNav.classList.remove('nav-unlocked');
    }
  }
  // pet 同理
}
```

**2) 完成最后一个任务时弹出引导**

在 `task-list.js` 的 `completeTask()` 成功回调中，检查是否刚完成最后一个 pending 任务：

```js
// completeTask 成功后
if (store.isTodayAllDone()) {
  showUnlockCelebration();
  store.setDailyUnlocked('shop');
  store.setDailyUnlocked('pet');
  updateNavUnlockState();
}
```

`showUnlockCelebration()` 弹窗设计：
- 彩色撒花动画 + 🎉🎉🎉
- "太棒了！今天的任务全部完成！"
- 两个按钮：
  - "去宠物乐园 🐾" → `navigateTo('pet')`
  - "逛逛星币商城 🏪" → `navigateTo('shop')`

**3) 门卫弹窗优化**

当用户从导航栏点击被锁的商城/宠物乐园时，门卫弹窗增加进度提示：

```
今日进度：3/5 任务已完成
还差2个任务就能解锁哦！💪
```

从 store 中获取今天任务总数和已完成数，显示进度条。

#### 改动文件清单

| 文件 | 改动 |
|------|------|
| `js/app.js` | 新增 `updateNavUnlockState()` + 初始化时调用 + `showUnlockCelebration()` 弹窗 |
| `js/task-list.js` | `completeTask()` 完成最后一个任务时触发庆祝弹窗 + 解锁 |
| `css/base.css` | 导航栏 `.nav-locked` / `.nav-unlocked` 样式 + 庆祝弹窗样式 |

---

### 12.4 执行优先级

| 优先级 | 问题 | 理由 |
|--------|------|------|
| P0 | 问题二：任务重复 | 影响日常使用体验，修复成本低 |
| P1 | 问题三：联动感知 | 完成任务后的正向激励闭环，体验提升明显 |
| P2 | 问题一：装扮系统 | 新功能，需改动较多文件，建议在P0/P1之后 |

### 12.5 待编码清单

**P0 - 任务去重** ✅ 已完成（2026-05-18）
- [x] `task-list.js`：收紧过滤逻辑
- [x] `weekly-plan.js`：reconcileTodayTasks 去重加强
- [x] `weekly-plan.js`：addPlanItem 去重提示
- [x] `parent-panel.js`：任务管理Tab 新增"清理重复"按钮
- [x] 同步到 `monster-pet/` 子目录

**P1 - 联动感知** ✅ 已完成（2026-05-18）
- [x] `app.js`：新增 `updateNavUnlockState()`
- [x] `app.js`：新增 `showUnlockCelebration()` 弹窗
- [x] `task-list.js`：completeTask 触发庆祝+解锁
- [x] `css/base.css`：导航栏解锁状态样式 + 庆祝弹窗样式
- [x] 同步到 `monster-pet/` 子目录

**P2 - 装扮系统** ✅ 已完成（2026-05-18）
- [x] `shop.js`：SHOP_ITEMS 扩展 + forPets + 装备按钮
- [x] `store.js`：buyItem 检查 forPets + equipAccessory / unequipAccessory
- [x] `pet-interaction.js`：装扮按钮 + 装扮面板
- [x] `pet-renderer.js`：drawAccessories 按类型适配坐标
- [x] `css/pet.css`：装扮面板样式
- [x] 同步到 `monster-pet/` 子目录

### 12.6 Bug 修复记录

#### 编辑周计划后已完成任务重新出现（2026-05-18）

**根因：** `weekly-plan.js` reconcileTodayTasks Step 2 统计模板计数时只统计 `status === 'pending'` 的任务。当用户完成所有任务后，所有任务状态变为 `completed`，此时编辑周计划触发 reconcile，Step 2 认为 `existingCount = 0`，于是为每个模板重新创建 pending 任务，导致"已完成任务重现"。

**修复：** 去掉 Step 2 的 `t.status === 'pending'` 过滤条件，改为统计所有状态的任务（pending/active/completed/done）。一个模板在当天最多存在 N 个任务（N = 计划中该模板出现次数），不管状态如何。

**改动文件：** `js/weekly-plan.js` 第 60 行（1 行修改）
