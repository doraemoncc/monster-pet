/**
 * 任务中心 - 任务列表展示
 * T5: 任务卡片 + tab 切换 + 宠物陪伴计时 + 结算弹窗
 */

// ===== 分类配置 =====
const CATEGORIES = {
  school: { name: '校内', emoji: '📚', color: '#42A5F5' },
  tutoring: { name: '校外', emoji: '🏫', color: '#7E57C2' },
  hobby: { name: '兴趣', emoji: '🎨', color: '#FF7043' },
  reading: { name: '阅读', emoji: '📖', color: '#66BB6A' },
  other: { name: '其他', emoji: '📝', color: '#78909C' }
};

// ===== 任务中心页面渲染 =====
let currentFilter = 'pending';
let currentCategory = 'all';
let activeTimer = null; // 当前计时任务
let timerStartTime = null;
let timerPetInterval = null;

function renderTasksPage() {
  const container = document.getElementById('page-tasks');
  if (!container) return;

  const tasks = window.store.get('tasks') || [];

  container.innerHTML = `
    <div class="tasks-header">
      <button class="btn btn-challenge" id="btn-challenges">🏆 挑战</button>
      <button class="btn btn-add-task" id="btn-add-task">+ 添加任务</button>
    </div>

    <div class="tasks-tabs" id="tasks-tabs">
      <button class="tab-btn active" data-filter="pending">待完成</button>
      <button class="tab-btn" data-filter="active">进行中</button>
      <button class="tab-btn" data-filter="completed">已完成</button>
    </div>

    <div class="tasks-categories" id="tasks-categories">
      <button class="cat-btn active" data-category="all">全部</button>
      ${Object.entries(CATEGORIES).map(([key, cat]) =>
        `<button class="cat-btn" data-category="${key}">${cat.emoji} ${cat.name}</button>`
      ).join('')}
    </div>

    <div class="tasks-list" id="tasks-list"></div>
  `;

  // 绑定 tab
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTaskList();
    });
  });

  // 绑定分类
  container.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderTaskList();
    });
  });

  // 绑定挑战按钮
  document.getElementById('btn-challenges').addEventListener('click', showChallenges);

  // 绑定添加任务按钮
  document.getElementById('btn-add-task').addEventListener('click', () => {
    showToast('请在家长面板中添加任务~', 'info');
  });

  renderTaskList();
}

// ===== 渲染任务列表 =====
function renderTaskList() {
  const listEl = document.getElementById('tasks-list');
  if (!listEl) return;

  const tasks = window.store.get('tasks') || [];

  // 过滤
  let filtered = tasks.filter(t => {
    if (currentFilter === 'active') return t.status === 'active';
    if (currentFilter === 'completed') return t.status === 'completed';
    return t.status === 'pending' || t.status === 'active';
  });

  // 分类过滤
  if (currentCategory !== 'all') {
    filtered = filtered.filter(t => t.category === currentCategory);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="tasks-empty">
        <div class="empty-icon">📋</div>
        <p>${currentFilter === 'completed' ? '还没有完成的任务' : '还没有任务哦~'}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(task => renderTaskCard(task)).join('');

  // 绑定卡片事件
  listEl.querySelectorAll('.task-card').forEach(card => {
    const taskId = card.dataset.taskId;

    // 开始/完成按钮
    const startBtn = card.querySelector('.btn-start');
    const completeBtn = card.querySelector('.btn-complete');
    const expandBtn = card.querySelector('.btn-expand');

    if (startBtn) {
      startBtn.addEventListener('click', () => startTask(taskId));
    }
    if (completeBtn) {
      completeBtn.addEventListener('click', () => completeTask(taskId));
    }
    if (expandBtn) {
      expandBtn.addEventListener('click', () => toggleSubtasks(taskId, card));
    }

    // 子任务打勾
    card.querySelectorAll('.subtask-check').forEach(check => {
      check.addEventListener('click', () => {
        const subtaskId = check.dataset.subtaskId;
        const result = window.store.completeSubtask(taskId, subtaskId);
        if (result && result.coinsEarned) {
          showTaskResult(taskId, result);
        }
        renderTaskList();
      });
    });

    // 更多菜单
    const moreBtn = card.querySelector('.task-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTaskMenu(taskId);
      });
    }
  });
}

// ===== 任务卡片 =====
function renderTaskCard(task) {
  const cat = CATEGORIES[task.category] || CATEGORIES.other;
  const isPending = task.status === 'pending';
  const isActive = task.status === 'active';
  const isCompleted = task.status === 'completed';
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const doneSubs = hasSubtasks ? task.subtasks.filter(s => s.done).length : 0;
  const totalSubs = hasSubtasks ? task.subtasks.length : 0;
  const isExpired = task.deadline && new Date(task.deadline) < new Date() && !isCompleted;
  const isExpiring = task.deadline && !isCompleted && (new Date(task.deadline) - new Date()) < 3600000;

  return `
    <div class="task-card ${isCompleted ? 'completed' : ''} ${isExpired ? 'expired' : ''} ${isExpiring ? 'expiring' : ''}" 
         data-task-id="${task.id}" style="border-left: 4px solid ${cat.color}">
      <div class="task-card-main">
        <div class="task-card-header">
          <span class="task-cat-badge" style="background:${cat.color}20;color:${cat.color}">${cat.emoji} ${cat.name}</span>
          <span class="task-coins-badge">💰${task.coins}</span>
          ${isExpiring ? '<span class="task-alert">🔔</span>' : ''}
          ${isExpired ? '<span class="task-expired-tag">已过期</span>' : ''}
          ${!moreBtnExists() ? '' : `<button class="task-more" title="更多">⋮</button>`}
        </div>
        <div class="task-title">${task.title}</div>
        ${hasSubtasks ? `
          <div class="task-progress">
            <div class="task-progress-bar">
              <div class="task-progress-fill" style="width:${totalSubs > 0 ? (doneSubs / totalSubs * 100) : 0}%"></div>
            </div>
            <span class="task-progress-text">${doneSubs}/${totalSubs}</span>
          </div>
        ` : ''}
        ${task.deadline ? `
          <div class="task-deadline ${isExpired ? 'expired' : ''}">
            📅 ${new Date(task.deadline).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        ` : ''}
        <div class="task-card-actions">
          ${isPending ? `<button class="btn btn-start">${hasSubtasks ? '开始 ▶' : '开始 ▶'}</button>` : ''}
          ${isActive && !hasSubtasks ? `<button class="btn btn-complete">完成 ✓</button>` : ''}
          ${isActive && hasSubtasks ? `<button class="btn btn-expand">${expandState(task.id) ? '收起 ▲' : '展开 ▼'}</button>` : ''}
          ${isCompleted ? '<span class="task-done-badge">✅ 已完成</span>' : ''}
        </div>
        ${isActive ? `
          <div class="task-timer">
            <span class="timer-display" id="timer-${task.id}">${formatTime(getElapsed(task))}</span>
            <span class="timer-pet-bubble" id="pet-bubble-${task.id}">📖 我陪你一起~</span>
          </div>
        ` : ''}
      </div>
      ${isActive && hasSubtasks && expandState(task.id) ? renderSubtasks(task) : ''}
    </div>
  `;
}

function moreBtnExists() {
  return true;
}

let expandedTasks = {};

function expandState(taskId) {
  return !!expandedTasks[taskId];
}

function toggleSubtasks(taskId, card) {
  expandedTasks[taskId] = !expandedTasks[taskId];
  renderTaskList();
}

function renderSubtasks(task) {
  return `
    <div class="subtask-list">
      ${task.subtasks.map(sub => `
        <div class="subtask-item ${sub.done ? 'done' : ''}">
          <button class="subtask-check ${sub.done ? 'checked' : ''}" data-subtask-id="${sub.id}">
            ${sub.done ? '✅' : '⬜'}
          </button>
          <span class="subtask-text ${sub.done ? 'done-text' : ''}">${sub.text}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== 任务操作 =====
function startTask(taskId) {
  const tasks = window.store.get('tasks');
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.status = 'active';
  task.startedAt = new Date().toISOString();
  window.store.set('tasks', tasks);

  // 开始计时
  activeTimer = taskId;
  timerStartTime = Date.now();
  startPetBubble(taskId);

  renderTaskList();
}

function completeTask(taskId) {
  const result = window.store.completeTask(taskId);
  if (!result) return;

  // 停止计时
  if (activeTimer === taskId) {
    activeTimer = null;
    stopPetBubble();
  }

  showTaskResult(taskId, result);
  renderTaskList();
  window.updateCoinDisplay && window.updateCoinDisplay();
}

function showTaskResult(taskId, result) {
  const task = window.store.get('tasks').find(t => t.id === taskId);
  const duration = task && task.duration ? task.duration : 0;
  const min = Math.floor(duration / 60);
  const sec = duration % 60;

  let bonusHtml = '';
  if (result.bonusDetail && result.bonusDetail.length > 0) {
    bonusHtml = result.bonusDetail.map(b => `<span>${b.icon}${b.label} +${b.value}</span>`).join(' ');
  }

  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';
  overlay.innerHTML = `
    <div class="result-card">
      <div class="result-icon">🎉</div>
      <div class="result-title">任务完成！</div>
      <div class="result-time">⏱️ 用了 ${min} 分 ${sec} 秒</div>
      <div class="result-coins">
        <div class="result-total">💰 +${result.coinsEarned}</div>
        ${bonusHtml ? `<div class="result-bonus">${bonusHtml}</div>` : ''}
      </div>
      <div class="result-exp">⭐ 经验 +${result.expEarned}</div>
      <button class="btn btn-result-close" id="result-close">太棒了！</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('result-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ===== 计时器 =====
function getElapsed(task) {
  if (!task.startedAt) return 0;
  if (task.completedAt) {
    return Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / 1000);
  }
  return Math.round((Date.now() - new Date(task.startedAt)) / 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 更新活跃计时器
function updateActiveTimer() {
  if (!activeTimer) return;
  const timerEl = document.getElementById(`timer-${activeTimer}`);
  if (timerEl) {
    const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    timerEl.textContent = formatTime(elapsed);
  }
}

// 宠物陪伴气泡切换
const PET_BUBBLES = [
  '📖 我陪你一起~', '💪 加油加油！', '😌 好安静呀~',
  '🥱 有点困...', '😸 一起学习！', '🤔 好难呀...'
];

function startPetBubble(taskId) {
  stopPetBubble();
  let bubbleIndex = 0;
  timerPetInterval = setInterval(() => {
    const bubbleEl = document.getElementById(`pet-bubble-${taskId}`);
    if (bubbleEl) {
      bubbleIndex = (bubbleIndex + 1) % PET_BUBBLES.length;
      bubbleEl.textContent = PET_BUBBLES[bubbleIndex];
    }
  }, 30000); // 每 30 秒切换
}

function stopPetBubble() {
  if (timerPetInterval) {
    clearInterval(timerPetInterval);
    timerPetInterval = null;
  }
}

// ===== 任务菜单 =====
function showTaskMenu(taskId) {
  const task = window.store.get('tasks').find(t => t.id === taskId);
  if (!task) return;

  // 简单的下拉菜单
  let menu = document.getElementById('task-menu');
  if (menu) menu.remove();

  menu = document.createElement('div');
  menu.id = 'task-menu';
  menu.className = 'task-menu-dropdown';
  menu.innerHTML = `
    <button class="menu-item" id="menu-delete">🗑️ 删除任务</button>
  `;
  document.body.appendChild(menu);

  // 定位到点击按钮附近
  const moreBtn = document.querySelector(`.task-card[data-task-id="${taskId}"] .task-more`);
  if (moreBtn) {
    const rect = moreBtn.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
  }

  document.getElementById('menu-delete').addEventListener('click', async () => {
    menu.remove();
    const confirmed = await window.showConfirm(`确定要删除任务"${task.title}"吗？`);
    if (confirmed) {
      const tasks = window.store.get('tasks').filter(t => t.id !== taskId);
      window.store.set('tasks', tasks);
      renderTaskList();
      showToast('任务已删除', 'info');
    }
  });

  // 点击外部关闭
  setTimeout(() => {
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 10);
}

// ===== 挑战面板 =====
function showChallenges() {
  const challenges = window.store.get('challenges') || [];

  const overlay = document.createElement('div');
  overlay.className = 'food-panel-overlay';
  overlay.innerHTML = `
    <div class="food-panel">
      <div class="food-panel-title">🏆 挑战任务</div>
      <div class="challenge-list">
        ${challenges.map(ch => `
          <div class="challenge-item ${ch.completed ? 'completed' : ''} ${ch.accepted ? 'accepted' : ''}">
            <div class="challenge-info">
              <div class="challenge-title">${ch.completed ? '✅' : ch.accepted ? '🔄' : '🎯'} ${ch.title}</div>
              <div class="challenge-desc">${ch.description}</div>
              <div class="challenge-reward">奖励：💰${ch.bonusCoins}</div>
            </div>
            ${!ch.accepted && !ch.completed ? `<button class="btn btn-accept-challenge" data-ch-id="${ch.id}">接受</button>` : ''}
            ${ch.accepted && !ch.completed ? '<span class="challenge-progress">进行中...</span>' : ''}
          </div>
        `).join('')}
      </div>
      <button class="btn btn-cancel" id="challenge-close">关闭</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.btn-accept-challenge').forEach(btn => {
    btn.addEventListener('click', () => {
      const chId = btn.dataset.chId;
      const challenges = window.store.get('challenges');
      const ch = challenges.find(c => c.id === chId);
      if (ch) {
        ch.accepted = true;
        window.store.set('challenges', challenges);
        showToast(`已接受挑战：${ch.title}`, 'success');
        overlay.remove();
        showChallenges();
      }
    });
  });

  document.getElementById('challenge-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ===== 计时器每秒更新 =====
setInterval(updateActiveTimer, 1000);

// ===== 页面事件 =====
window.bus.on('page:enter', (pageName) => {
  if (pageName === 'tasks') {
    renderTasksPage();
  }
});

window.bus.on('page:leave', (pageName) => {
  if (pageName === 'tasks') {
    stopPetBubble();
  }
});

// 数据变化时刷新列表
window.bus.on('data:changed', (key) => {
  if (key && (key.includes('tasks') || key.includes('challenges'))) {
    if (document.querySelector('#page-tasks.active')) {
      renderTaskList();
    }
  }
});
