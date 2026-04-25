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
4. `window.scrollTo(0, 0)`
5. 进入事件 `page:enter`（触发渲染函数）

### 11.3 parentTab 初始值规范

`parent-panel.js` 中 `parentTab` 的初始值必须与 `renderParentContent()` 中第一个 tab 的 `data-tab` 值一致。

| 版本 | 第一个 tab | parentTab 初始值 |
|------|-----------|----------------|
| v2 | `task-mgmt` | `'task-mgmt'` |

**违反此规则会导致家长面板首次进入时内容区空白。**

### 11.4 CSS 修改检查清单

每次修改任何 CSS 文件后，必须检查：

- [ ] 没有用 `padding: Xpx` 简写覆盖掉各页面的 `padding-top`
- [ ] 没有修改 `.page.active` 的 `display` 属性（必须是 `block`，`#page-pet.active` 是 `flex`）
- [ ] 响应式媒体查询中没有覆盖各页面的 `padding-top`
- [ ] `parent-lock` 的 `padding-top` 在平板尺寸下是否过大
- [ ] `body` 没有多余的 `padding-top`/`padding-bottom`（已在 base.css 中移除，各页面独立处理）
