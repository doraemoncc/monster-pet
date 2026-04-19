/**
 * 定时提醒 + 重复任务刷新
 * T7: 每 30 秒检查提醒，页面可见时刷新重复任务
 */

let reminderInterval = null;
let remindedToday = new Set();

function startReminderCheck() {
  // 清空每日已提醒
  window.store.clearRemindedTasks();
  remindedToday.clear();

  // 页面可见时立即检查
  checkReminders();
  checkRepeatTasks();

  // 监听页面可见性
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkReminders();
      checkRepeatTasks();
    }
  });

  // 每 30 秒检查
  reminderInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkReminders();
    }
  }, 30000);
}

function checkReminders() {
  const tasks = window.store.get('tasks') || [];
  const reminded = window.store.get('remindedTasks') || [];
  const now = Date.now();

  tasks.forEach(task => {
    if (task.status !== 'pending' && task.status !== 'active') return;
    if (!task.deadline) return;
    if (reminded.includes(task.id)) return;

    const deadline = new Date(task.deadline).getTime();
    const diff = deadline - now;

    // 已过期
    if (diff < 0) {
      showToast(`⏰ "${task.title}" 已过期`, 'warning');
      task.status = 'expired';
      reminded.push(task.id);
      window.store.set('remindedTasks', reminded);
      window.store.set('tasks', tasks);
    }
    // 30 分钟内
    else if (diff < 1800000 && !reminded.includes(task.id + '_30min')) {
      showToast(`🔔 主人，"${task.title}"快到时间了！`, 'info');
      reminded.push(task.id + '_30min');
      window.store.set('remindedTasks', reminded);
    }
    // 5 分钟内
    else if (diff < 300000 && !reminded.includes(task.id + '_5min')) {
      showToast(`⏰ "${task.title}" 只剩 5 分钟了！`, 'warning');
      reminded.push(task.id + '_5min');
      window.store.set('remindedTasks', reminded);
    }
  });
}

function checkRepeatTasks() {
  const changed = window.store.resetRepeatTasks();
  if (changed) {
    // 刷新 UI
    if (document.querySelector('#page-tasks.active')) {
      renderTaskList();
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  startReminderCheck();
});
