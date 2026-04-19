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

  // 检查现有任务是否已有今天的任务（避免重复）
  const existingTasks = window.store.get('tasks') || [];
  const todayExisting = existingTasks.filter(t => {
    if (t.repeat !== 'daily' && t.repeat !== 'weekly') return false;
    // 检查是否是今天重置过的
    return t.lastResetDate === todayStr;
  });

  // 合并周计划中的模板到今日任务
  dayPlan.forEach(planItem => {
    // 检查是否已存在
    const templateId = planItem.templateId;
    // 查找是否已有同模板任务
    const exists = todayExisting.some(t => t._templateId === templateId);
    if (exists) return;

    // 查找模板
    const template = window.store.get('allTemplates')?.[templateId]
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
    }
  });

  if (existingTasks.length > 0) {
    window.store.set('tasks', existingTasks);
    window.store.set('_lastDailyGen', todayStr);
  }
}

// 初始化时检查
document.addEventListener('DOMContentLoaded', () => {
  checkDailyPlanGeneration();
});
