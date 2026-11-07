/**
 * 周计划管理 + 每日自动生成
 * T7.5: 根据周计划自动生成每日任务
 * v1.1: reconcileTodayTasks —— 编辑周计划立即同步任务中心
 * v2.0: 多套周计划模板 + 单周临时覆盖
 */

// ===== 工具：从模板 + 计划条目构建任务对象 =====
function buildTaskFromTemplate(template, planItem, todayStr) {
  const task = {
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

  // 阅读类任务：按语言模式写入当日书目（并推进轮转指针）
  if (template.category === 'reading') {
    ensureReadingBooks(task);
  }

  return task;
}

// ===== 阅读书目：按语言模式为阅读任务分配当日书目 =====
// 返回 [{ bookId, bookTitle, lang }]，并推进 readingRotation 指针（手动换书后也按此指针继续轮转）
function assignReadingBooksForTask() {
  const books = window.store.get('readingBooks') || [];
  const rotation = window.store.get('readingRotation') || { en: null, cn: null };
  // 每日阅读任务同时带中文 + 英文各一本（有啥取啥）；完成任一即可标记当天完成
  const langs = ['cn', 'en'];
  const result = [];

  langs.forEach(lang => {
    const pool = books.filter(b => b.lang === lang);
    if (pool.length === 0) return;
    let idx = 0;
    const nextId = rotation[lang];
    if (nextId) {
      const fi = pool.findIndex(b => b.id === nextId);
      if (fi >= 0) idx = fi; // 找不到（被删）则从第一本开始
    }
    const chosen = pool[idx];
    result.push({ bookId: chosen.id, bookTitle: chosen.title, lang });
    // 推进指针到下一本，下次分配从此继续（手动换书也会调用本函数更新指针）
    const nextIdx = (idx + 1) % pool.length;
    rotation[lang] = pool[nextIdx].id;
  });

  window.store.set('readingRotation', rotation);
  return result;
}

// ===== 保证某阅读任务当天已分配书目（每天仅分配一次，避免重置/回填/新建重复推进轮转）=====
function ensureReadingBooks(task) {
  if (!task || task.category !== 'reading') return;
  const todayStr = new Date().toISOString().slice(0, 10);
  // 已分配且是今天 → 跳过（保证每天只推进一次轮转）
  if (task.books && task.bookAssignDate === todayStr) return;
  task.books = assignReadingBooksForTask();
  task.readingMode = 'both';
  task.bookAssignDate = todayStr;
}

// 为当天所有阅读任务补/换当日书目（兼容旧任务、未重置任务、刚升级）
function ensureAllReadingBooksForToday() {
  const tasks = window.store.get('tasks') || [];
  let changed = false;
  tasks.forEach(t => {
    if (t.category === 'reading') {
      const before = JSON.stringify(t.books);
      ensureReadingBooks(t);
      if (JSON.stringify(t.books) !== before) changed = true;
    }
  });
  if (changed) window.store.set('tasks', tasks);
}

// ===== 获取某天的有效计划（优先本周临时覆盖，其次 weeklyPlan）=====
function getEffectivePlanForDay(dayIndex, dateStr) {
  // 检查本周临时覆盖
  const override = window.store.getActiveWeekOverride ? window.store.getActiveWeekOverride() : null;
  if (override && override.plan) {
    const overridePlan = override.plan[dayIndex];
    if (overridePlan !== undefined) return overridePlan;
  }
  // 无覆盖，使用常规 weeklyPlan
  const weeklyPlan = window.store.get('weeklyPlan') || {};
  return weeklyPlan[dayIndex] || [];
}

// ===== 核心同步：对账今天的任务和周计划 =====
// 每次编辑周计划后调用，以最新计划为准
function reconcileTodayTasks(dayIndex) {
  const today = new Date().getDay();
  if (dayIndex !== today) return; // 只处理今天，其他天等明天自动生成时以最新计划为准

  const todayStr = new Date().toISOString().slice(0, 10);
  const planItems = getEffectivePlanForDay(dayIndex, todayStr);
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

// ===== 检查并处理过期（模板过期 + 本周覆盖过期）=====
function checkPlanExpiry() {
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. 检查周计划模板有效期
  const templateExpiry = window.store.get('planTemplateExpiry');
  if (templateExpiry && todayStr > templateExpiry) {
    window.store.set('activePlanTemplateId', null);
    window.store.set('planTemplateExpiry', null);
    // 注意：weeklyPlan 保持不变（上次模板应用时的状态），仅清除模板关联
    console.log('[PlanExpiry] 周计划模板已过期，恢复手动模式');
  }

  // 2. 检查本周临时覆盖有效期
  const overrides = window.store.get('weekOverrides') || {};
  let overridesChanged = false;
  Object.keys(overrides).forEach(weekKey => {
    const ov = overrides[weekKey];
    if (ov.expiry && todayStr > ov.expiry) {
      delete overrides[weekKey];
      overridesChanged = true;
      console.log('[PlanExpiry] 本周临时覆盖已过期，已清除', weekKey);
    }
  });
  if (overridesChanged) {
    window.store.set('weekOverrides', overrides);
  }
}

// ===== 每日自动生成（启动时调用）=====
function checkDailyPlanGeneration() {
  const today = new Date();
  const dayIndex = today.getDay();
  const todayStr = today.toISOString().slice(0, 10);

  // 先检查过期
  checkPlanExpiry();

  // 保证当天所有阅读任务都拿到当日书目（每天仅推进一次轮转）
  ensureAllReadingBooksForToday();

  // 获取今天的有效计划
  const dayPlan = getEffectivePlanForDay(dayIndex, todayStr);
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
