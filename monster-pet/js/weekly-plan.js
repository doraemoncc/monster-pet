/**
 * 周计划管理 + 每日自动生成
 * T7.5: 根据周计划自动生成每日任务
 */

function checkDailyPlanGeneration() {
  const today = new Date();
  const dayIndex = today.getDay(); // 0=日, 1=一, ...
  const todayStr = today.toISOString().slice(0, 10);

  const weeklyPlan = window.store.get('weeklyPlan') || {};
  const dayPlan = weeklyPlan[dayIndex] || [];

  if (dayPlan.length === 0) return; // 今天没计划

  // 检查是否已生成
  const lastGenDate = window.store.get('_lastDailyGen');
  if (lastGenDate === todayStr) return; // 今天已生成

  _applyDayPlanToTasks(dayIndex, todayStr, dayPlan);
}

// 将指定天的周计划应用到任务列表（立即生效版，可重复调用）
function applyWeeklyPlanNow(dayIndex) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date().getDay();
  if (dayIndex !== today) return; // 只对今天生效

  const weeklyPlan = window.store.get('weeklyPlan') || {};
  const dayPlan = weeklyPlan[dayIndex] || [];

  _applyDayPlanToTasks(dayIndex, todayStr, dayPlan, true);
}

// 核心：将计划转为任务（allowUpdate=true 时允许新增缺少的任务）
function _applyDayPlanToTasks(dayIndex, todayStr, dayPlan, allowUpdate = false) {
  const existingTasks = window.store.get('tasks') || [];

  // 现有今天已生成的任务
  const todayExisting = existingTasks.filter(t => {
    if (t.repeat !== 'daily' && t.repeat !== 'weekly') return false;
    return t.lastResetDate === todayStr;
  });

  let changed = false;

  dayPlan.forEach(planItem => {
    const templateId = planItem.templateId;
    const exists = todayExisting.some(t => t._templateId === templateId);
    if (exists) return;

    // 查找模板
    const myTemplates = window.store.get('myTemplates') || [];
    const template = myTemplates.find(t => t.id === templateId)
      || DEFAULT_TEMPLATES.find(t => t.id === templateId);

    if (template) {
      const newTask = {
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
        _templateId: templateId
      };

      existingTasks.push(newTask);
      changed = true;
    }
  });

  if (changed || !allowUpdate) {
    window.store.set('tasks', existingTasks);
    window.store.set('_lastDailyGen', todayStr);
  }
}

// 初始化时检查
document.addEventListener('DOMContentLoaded', () => {
  checkDailyPlanGeneration();
});
