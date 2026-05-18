/**
 * 周计划管理 + 每日自动生成
 * T7.5: 根据周计划自动生成每日任务
 * v1.1: reconcileTodayTasks —— 编辑周计划立即同步任务中心
 */

// ===== 工具：从模板 + 计划条目构建任务对象 =====
function buildTaskFromTemplate(template, planItem, todayStr) {
  return {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: template.title,
    category: template.category,
    subtasks: (template.subtasks || []).map((s, i) => ({
      id: `st_${Date.now()}_${i}`,
      text: typeof s === 'string' ? s : (s.text || ''),
      done: false
    })),
    deadline: null,
    repeat: 'daily',
    coins: planItem.coins || template.coins || 5,
    estimatedMinutes: template.estimatedMinutes || 0,
    status: 'pending',
    creator: 'plan',
    enabled: true,
    isTimed: planItem.isTimed || false,
    startedAt: null,
    completedAt: null,
    duration: null,
    isEarlyBird: false,
    coinsEarned: null,
    createdAt: new Date().toISOString(),
    lastResetDate: todayStr,
    _templateId: planItem.templateId
  };
}

// ===== 核心同步：对账今天的任务和周计划 =====
// 每次编辑周计划后调用，以最新计划为准
function reconcileTodayTasks(dayIndex) {
  const today = new Date().getDay();
  if (dayIndex !== today) return; // 只处理今天，其他天等明天自动生成时以最新计划为准

  const todayStr = new Date().toISOString().slice(0, 10);
  const weeklyPlan = window.store.get('weeklyPlan') || {};
  const planItems = weeklyPlan[dayIndex] || [];
  let tasks = window.store.get('tasks') || [];

  // Step 1: 删除多余任务（从周计划移除了、但任务还在 pending）
  const planTemplateIds = new Set(planItems.map(p => p.templateId));
  tasks = tasks.filter(t => {
    if (t.creator !== 'plan' || t.lastResetDate !== todayStr) return true; // 不是今天计划任务，保留
    if (planTemplateIds.has(t._templateId)) return true;                   // 计划中还有，保留
    // 计划中已删除：已完成保留，pending 删除
    return t.status === 'completed' || t.status === 'done';
  });

  // Step 2: 新增计划中有、但任务中没有的（按计数器去重，支持同模板出现N次）
  // 注意：必须统计所有状态的任务（含completed），否则已完成任务不计入，会导致重复创建
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
    // 计算该 templateId 在周计划中总共应出现几次
    const maxCount = planItems.filter(p => p.templateId === tid).length;
    if (existingCount >= maxCount) return; // 已够数量，跳过
    const myTemplates = window.store.get('myTemplates') || [];
    const template =
      myTemplates.find(t => t.id === planItem.templateId) ||
      DEFAULT_TEMPLATES.find(t => t.id === planItem.templateId);
    if (!template) return; // 模板不存在，跳过
    tasks.push(buildTaskFromTemplate(template, planItem, todayStr));
    templateCount[tid] = existingCount + 1;
  });

  // Step 3: 更新 coins（仅 pending 任务，已完成的不改）
  tasks.forEach(t => {
    if (t.creator !== 'plan' || t.lastResetDate !== todayStr) return;
    if (t.status === 'completed' || t.status === 'done') return;
    const planItem = planItems.find(p => p.templateId === t._templateId);
    if (planItem && planItem.coins !== t.coins) {
      t.coins = planItem.coins;
    }
  });

  window.store.set('tasks', tasks);
  window.store.set('_lastDailyGen', todayStr);
}

// ===== 每日自动生成（启动时调用）=====
function checkDailyPlanGeneration() {
  const today = new Date();
  const dayIndex = today.getDay();
  const todayStr = today.toISOString().slice(0, 10);

  const weeklyPlan = window.store.get('weeklyPlan') || {};
  const dayPlan = weeklyPlan[dayIndex] || [];

  if (dayPlan.length === 0) return; // 今天没计划

  // 检查是否已生成
  const lastGenDate = window.store.get('_lastDailyGen');
  if (lastGenDate === todayStr) return; // 今天已生成

  // 直接用 reconcile，逻辑统一
  reconcileTodayTasks(dayIndex);
}

// ===== 初始化时检查 =====
document.addEventListener('DOMContentLoaded', () => {
  checkDailyPlanGeneration();
});

// ===== 清理重复任务（家长面板调用）=====
// 同一天同一模板只保留第一个 pending 任务，其余删除
function cleanDuplicateTasks() {
  const todayStr = new Date().toISOString().slice(0, 10);
  let tasks = window.store.get('tasks') || [];
  const seen = {};
  let removed = 0;

  tasks = tasks.filter(t => {
    // 非计划任务不去重
    if (t.creator !== 'plan') return true;
    // 只清理 pending 状态的重复任务
    if (t.status !== 'pending') return true;
    const key = `${t._templateId}_${t.lastResetDate}`;
    if (seen[key]) {
      removed++;
      return false;
    }
    seen[key] = true;
    return true;
  });

  if (removed > 0) {
    window.store.set('tasks', tasks);
  }
  return removed;
}
