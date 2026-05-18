# 周计划编辑同步设计文档

> 版本：v1.0  
> 日期：2026-04-27  
> 状态：待开发  

---

## 一、背景与问题

### 1.1 现状

周计划已有增减任务操作（`addPlanItem` / `removePlanItem`），但同步策略不完整：

| 操作 | 今天的任务 | 非今天的任务 |
|------|-----------|------------|
| 新增 | ✅ 立即生成到任务中心 | ⚠️ 仅写入 weeklyPlan，等下次自动生成 |
| 删除 | ✅ 删除 pending 状态任务 | ⚠️ 仅从 weeklyPlan 删除，已生成任务不处理 |
| 改星币 | ❌ 不同步到已有任务 | ❌ 不同步 |

### 1.2 核心问题

**当周计划已生成过（`_lastDailyGen` 有记录），今天再改周计划，任务中心不会更新。**

原因：`_applyDayPlanToTasks` 逻辑是"只新增缺少的任务"，不处理"删除多余的"和"更新已有的"。

---

## 二、目标

**编辑完周计划，立即以最新内容为准，任务中心同步更新。**

具体：
1. **新增**：任务中心立即新增对应任务（当天或未来每天）
2. **删除**：任务中心中对应 `pending` 状态任务立即删除
3. **改星币**：任务中心中对应 `pending` 状态任务的 `coins` 字段同步更新
4. **幂等性**：反复编辑不产生重复任务；已完成（`done`/`completed`）的任务不被删除或改星币

---

## 三、核心规则

### 3.1 同步范围

同步**仅针对当天**的任务（`lastResetDate === todayStr`）：
- 非今天的星期由 daily 自动生成机制处理（第二天生成时以最新 weeklyPlan 为准）
- 之所以只处理今天：避免影响其他天已完成的任务记录

### 3.2 "以最新内容为准"逻辑

每次编辑周计划（增/删/改）后，对今天执行 **reconcile（对账）** 操作：

```
reconcileTodayTasks(dayIndex)
  ├── 读取 weeklyPlan[dayIndex]（最新计划）
  ├── 读取 tasks（今天由周计划生成的任务，即 creator='plan' && lastResetDate=今天）
  ├── 新增：计划中有、任务中没有的 → 生成新任务
  ├── 删除：任务中有、计划中没有的 → 删除 pending 任务（completed/done 保留）
  └── 更新：计划中有、任务中也有的 → 如果 pending，更新 coins
```

### 3.3 已完成任务保护

- `status === 'completed'` 或 `status === 'done'` 的任务：**不删除、不改星币**
- 原因：孩子已完成的任务记录不能被家长编辑覆盖

---

## 四、实现方案

### 4.1 新增函数 `reconcileTodayTasks(dayIndex)`

**位置**：`weekly-plan.js`

```javascript
function reconcileTodayTasks(dayIndex) {
  const today = new Date().getDay();
  if (dayIndex !== today) return; // 只处理今天

  const todayStr = new Date().toISOString().slice(0, 10);
  const weeklyPlan = window.store.get('weeklyPlan') || {};
  const planItems = weeklyPlan[dayIndex] || [];
  let tasks = window.store.get('tasks') || [];

  // 今天由周计划生成的任务
  const todayPlanTasks = tasks.filter(t =>
    t.creator === 'plan' && t.lastResetDate === todayStr
  );

  // Step 1: 删除多余任务（计划已移除，但任务还在 pending）
  const planTemplateIds = new Set(planItems.map(p => p.templateId));
  tasks = tasks.filter(t => {
    if (t.creator !== 'plan' || t.lastResetDate !== todayStr) return true;
    if (planTemplateIds.has(t._templateId)) return true;
    // 计划中已删除：只删 pending，保留已完成
    return t.status === 'completed' || t.status === 'done';
  });

  // Step 2: 新增缺少的任务
  const existingTemplateIds = new Set(
    tasks.filter(t => t.creator === 'plan' && t.lastResetDate === todayStr)
         .map(t => t._templateId)
  );
  planItems.forEach(planItem => {
    if (existingTemplateIds.has(planItem.templateId)) return;
    const template = findTemplate(planItem.templateId);
    if (!template) return;
    tasks.push(buildTaskFromTemplate(template, planItem, todayStr));
  });

  // Step 3: 更新 coins（仅 pending 任务）
  tasks.forEach(t => {
    if (t.creator !== 'plan' || t.lastResetDate !== todayStr) return;
    if (t.status === 'completed' || t.status === 'done') return;
    const planItem = planItems.find(p => p.templateId === t._templateId);
    if (planItem && planItem.coins !== t.coins) {
      t.coins = planItem.coins;
    }
  });

  window.store.set('tasks', tasks);
  window.store.set('_lastDailyGen', todayStr); // 确保标记今天已生成
}
```

### 4.2 提取公共函数 `buildTaskFromTemplate(template, planItem, todayStr)`

将 `_applyDayPlanToTasks` 里的任务构建逻辑提取出来，供两处复用。

### 4.3 修改 `addPlanItem` / `removePlanItem` / `openCoinEditor`（均在 parent-panel.js）

写入 weeklyPlan 后，调用 `reconcileTodayTasks(dayIndex)` 替代原来的 `applyWeeklyPlanNow`。

```javascript
// 原来
if (dayIndex === today && typeof applyWeeklyPlanNow === 'function') {
  applyWeeklyPlanNow(dayIndex);
}

// 改为
if (typeof reconcileTodayTasks === 'function') {
  reconcileTodayTasks(dayIndex);
}
```

### 4.4 修改 `_applyDayPlanToTasks`（兼容初次生成）

初次生成时（每天第一次）直接调用 `reconcileTodayTasks`，不再单独维护两套逻辑。

---

## 五、影响范围

| 文件 | 改动内容 |
|------|---------|
| `weekly-plan.js` | 新增 `reconcileTodayTasks`，提取 `buildTaskFromTemplate`，重构 `_applyDayPlanToTasks` |
| `parent-panel.js` | `addPlanItem`、`removePlanItem`、`openCoinEditor(save)` 替换同步调用 |

---

## 六、边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 今天已完成的任务被从周计划删除 | 保留（不删已完成记录） |
| 同一模板在一天内添加两次 | 第二次 `addPlanItem` 不阻止，但 reconcile 时按 templateId 去重（只生成一个任务） |
| 非今天改周计划 | 只更新 weeklyPlan，明天自动生成时以最新计划为准 |
| 模板不存在（被删除） | 跳过，不生成任务 |

---

## 七、测试场景

1. 今天周计划为空 → 添加任务 A → 任务中心立即出现任务 A ✅
2. 今天周计划有 A、B → 删除 A（pending）→ 任务中心 A 消失 ✅
3. 今天周计划有 A（已完成）→ 删除 A → 任务中心 A 保留 ✅
4. 今天周计划有 A（pending，coins=5）→ 改为 10 → 任务中心 A.coins 变为 10 ✅
5. 明天周计划改动 → 任务中心今天不变，明天自动生成时生效 ✅
