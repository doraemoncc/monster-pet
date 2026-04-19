/**
 * 任务中心 - 重构版
 * 日期时间轴 + 情感引导语 + 迷你宠物面板 + 任务卡片改造
 */

// ===== 分类配置 =====
const CATEGORIES = {
  school: { name: '校内', emoji: '📚', color: '#42A5F5' },
  tutoring: { name: '校外', emoji: '🏫', color: '#7E57C2' },
  hobby: { name: '兴趣', emoji: '🎨', color: '#FF7043' },
  reading: { name: '阅读', emoji: '📖', color: '#66BB6A' },
  other: { name: '其他', emoji: '📝', color: '#78909C' }
};

// ===== 状态变量 =====
let currentCategory = 'all';
let selectedDate = null; // 选中日期 (Date)
let activeTimer = null;
let timerStartTime = null;
let timerPetInterval = null;
let expandedTasks = {};

// ===== 日期工具 =====
function getWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function dateKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function isToday(date) {
  return isSameDay(date, new Date());
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ===== 情感引导语 =====
function getGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const pet = window.store.getActivePet();
  const petName = pet ? pet.name : '小伙伴';
  const tasks = window.store.get('tasks') || [];
  const todayKey = dateKey();
  const pendingToday = tasks.filter(t =>
    (t.status === 'pending' || t.status === 'active') &&
    (!t.repeat || t.repeat === 'daily' || t.repeat === 'once') &&
    (!t.lastResetDate || t.lastResetDate === todayKey)
  );
  const pendingCount = pendingToday.length;

  // 日期英文行
  const month = EN_MONTHS[now.getMonth()];
  const day = now.getDate();
  const weekday = EN_DAYS[now.getDay()];
  const dateLine = `Today is ${month} ${day}, ${weekday}`;

  // 引导语
  let message;
  if (pendingCount === 0) {
    message = '太棒了！今天的任务全部搞定！🎉';
  } else if (hour < 12) {
    const msgs = [
      `新的一天开始啦，${petName}陪你一起加油！💪`,
      `早上好~ 今天有 ${pendingCount} 个任务等你哦~ ☀️`,
      `元气满满的早晨！${petName}已经迫不及待了~ 🌟`
    ];
    message = msgs[Math.floor(Math.random() * msgs.length)];
  } else if (hour < 18) {
    const msgs = [
      `下午好~ 还有 ${pendingCount} 个任务，${petName}在等你哦~`,
      `加油鸭！${petName}说下午效率最高！ afternoon power~ ⚡`,
      `${pendingCount} 个任务等你完成，${petName}相信你可以的！😊`
    ];
    message = msgs[Math.floor(Math.random() * msgs.length)];
  } else {
    const msgs = [
      `辛苦啦~ 还有 ${pendingCount} 个任务没完成，再坚持一下！🌙`,
      `晚上好~ ${petName}说完成最后一个任务就能安心休息啦~ ✨`,
      `夜幕降临，${petName}陪你把剩下的任务搞定吧！🦉`
    ];
    message = msgs[Math.floor(Math.random() * msgs.length)];
  }

  return { dateLine, message };
}

// ===== 检查某天有多少待完成/已完成任务 =====
function getDayTaskCounts(date) {
  const tasks = window.store.get('tasks') || [];
  const key = dateKey(date);
  // 对于每日重复任务，只需要检查今天是否有重置后的 pending
  // 对于一次性任务，检查 createdAt 是否在那一天
  // 简化：检查有已完成记录的历史
  const history = window.store.get('completedHistory') || [];
  const completedOnDay = history.filter(h =>
    h.completedAt && h.completedAt.startsWith(key)
  ).length;

  // 当前待完成（只对今天有意义）
  let pendingCount = 0;
  if (isToday(date)) {
    pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'active').length;
  }

  return { completed: completedOnDay, pending: pendingCount };
}

// ===== 迷你宠物面板 =====
function renderMiniPetPanel() {
  const pet = window.store.getActivePet();
  if (!pet) return '';

  const petType = (typeof PET_TYPES !== 'undefined') ? (PET_TYPES[pet.type] || PET_TYPES.cat) : { emoji: '🐱', name: '宠物' };
  const stageName = (typeof STAGE_NAMES !== 'undefined') ? (STAGE_NAMES[pet.stage] || '蛋') : pet.stage;
  const emoji = pet.stage === 0 ? '🥚' : petType.emoji;

  // 经验进度
  let expPct = 0;
  let expText = '';
  const STAGE_EXP_VALS = (typeof STAGE_EXP !== 'undefined') ? STAGE_EXP : [0, 200, 600, 1500];
  if (pet.stage >= 3) {
    const ml = pet.masterLevel || 0;
    const base = STAGE_EXP_VALS[3] || 1500;
    expPct = Math.min(100, ((pet.exp - base) % 500) / 500 * 100);
    expText = `大师 Lv.${ml}`;
  } else if (pet.stage < STAGE_EXP_VALS.length - 1) {
    const cur = STAGE_EXP_VALS[pet.stage] || 0;
    const next = STAGE_EXP_VALS[pet.stage + 1] || cur;
    expPct = next > cur ? Math.min(100, (pet.exp - cur) / (next - cur) * 100) : 100;
    expText = stageName;
  } else {
    expPct = 100;
    expText = stageName;
  }

  return `
    <div class="pet-mini-panel" id="pet-mini-panel">
      <div class="pet-mini-avatar">${emoji}</div>
      <div class="pet-mini-name">${pet.name}</div>
      <div class="pet-mini-stage">${expText}</div>
      <div class="pet-mini-progress">
        <div class="pet-mini-bar">
          <div class="pet-mini-fill" style="width:${expPct}%"></div>
        </div>
        <span class="pet-mini-pct">${Math.round(expPct)}%</span>
      </div>
      <div class="pet-mini-stats">
        <div class="pet-mini-stat">⚡${pet.energy || 0}</div>
        <div class="pet-mini-stat">⭐${pet.exp || 0}</div>
      </div>
    </div>
  `;
}

// ===== 任务中心页面渲染（重构版） =====
function renderTasksPage() {
  const container = document.getElementById('page-tasks');
  if (!container) return;

  // 初始化选中日期为今天
  if (!selectedDate || !isToday(selectedDate)) {
    selectedDate = new Date();
  }

  const weekDates = getWeekDates();
  const greeting = getGreeting();

  container.innerHTML = `
    <!-- 日期时间轴 -->
    <div class="task-date-bar" id="task-date-bar">
      ${weekDates.map(d => {
        const today = isToday(d);
        const selected = isSameDay(d, selectedDate);
        const counts = getDayTaskCounts(d);
        const weekdayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
        return `
          <button class="date-btn ${today ? 'today' : ''} ${selected ? 'selected' : ''}" data-date="${d.toISOString()}">
            <span class="date-weekday">${WEEKDAY_LABELS[weekdayIdx]}</span>
            <span class="date-day">${d.getDate()}</span>
            ${counts.completed > 0 && !today ? '<span class="date-dot done"></span>' : ''}
            ${counts.pending > 0 && today ? '<span class="date-dot pending"></span>' : ''}
          </button>
        `;
      }).join('')}
    </div>

    <!-- 情感引导语 -->
    <div class="task-greeting">
      <div class="greeting-date">${greeting.dateLine}</div>
      <div class="greeting-msg">${greeting.message}</div>
    </div>

    <!-- 主内容区：左侧宠物面板 + 右侧任务列表 -->
    <div class="task-main-content">
      ${renderMiniPetPanel()}
      <div class="task-cards-area">
        <!-- 分类筛选 -->
        <div class="tasks-categories" id="tasks-categories">
          <button class="cat-btn active" data-category="all">全部</button>
          ${Object.entries(CATEGORIES).map(([key, cat]) =>
            `<button class="cat-btn" data-category="${key}">${cat.emoji} ${cat.name}</button>`
          ).join('')}
        </div>
        <!-- 任务列表 -->
        <div class="tasks-list" id="tasks-list"></div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="task-action-bar">
      <button class="btn btn-challenge" id="btn-challenges">🏆 挑战</button>
      <button class="btn btn-add-task" id="btn-add-task">➕ 添加任务</button>
    </div>
  `;

  // 绑定日期切换
  container.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDate = new Date(btn.dataset.date);
      renderTasksPage();
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

  // 点击迷你面板跳转宠物乐园
  const miniPanel = document.getElementById('pet-mini-panel');
  if (miniPanel) {
    miniPanel.addEventListener('click', () => {
      window.location.hash = 'pet';
    });
    miniPanel.style.cursor = 'pointer';
  }

  renderTaskList();
}

// ===== 渲染任务列表 =====
function renderTaskList() {
  const listEl = document.getElementById('tasks-list');
  if (!listEl) return;

  const tasks = window.store.get('tasks') || [];

  // 只显示非已完成的任务（待完成+进行中）
  let filtered = tasks.filter(t => t.status === 'pending' || t.status === 'active');

  // 分类过滤
  if (currentCategory !== 'all') {
    filtered = filtered.filter(t => t.category === currentCategory);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="tasks-empty">
        <div class="empty-icon">🐱</div>
        <p>${currentCategory !== 'all' ? '这个分类还没有任务~' : '没有待完成的任务，去逛逛商城吧~'}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(task => renderTaskCard(task)).join('');

  // 绑定卡片事件
  listEl.querySelectorAll('.task-card').forEach(card => {
    const taskId = card.dataset.taskId;
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

// ===== 任务卡片（改造版） =====
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
  const estMin = task.estimatedMinutes;

  return `
    <div class="task-card ${isCompleted ? 'completed' : ''} ${isExpired ? 'expired' : ''} ${isExpiring ? 'expiring' : ''}"
         data-task-id="${task.id}" style="border-left: 4px solid ${cat.color}">
      <div class="task-card-main">
        <div class="task-card-header">
          <span class="task-cat-badge" style="background:${cat.color}20;color:${cat.color}">${cat.emoji} ${cat.name}</span>
          <div class="task-card-meta">
            ${estMin ? `<span class="task-time-badge">⏱️${estMin}min</span>` : ''}
            <span class="task-coins-badge">⚡${task.coins}</span>
          </div>
          ${isExpiring ? '<span class="task-alert">🔔</span>' : ''}
          ${isExpired ? '<span class="task-expired-tag">已过期</span>' : ''}
          <button class="task-more" title="更多">⋮</button>
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
          ${isPending ? `<button class="btn btn-start">开始 ▶</button>` : ''}
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

  activeTimer = taskId;
  timerStartTime = Date.now();
  startPetBubble(taskId);

  renderTaskList();
}

function completeTask(taskId) {
  const result = window.store.completeTask(taskId);
  if (!result) return;

  if (activeTimer === taskId) {
    activeTimer = null;
    stopPetBubble();
  }

  showTaskResult(taskId, result);
  renderTaskList();
  window.updateCoinDisplay && window.updateCoinDisplay();

  // 刷新迷你宠物面板
  updateMiniPetPanel();
  // 刷新引导语
  updateGreeting();
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

// ===== 局部刷新辅助函数 =====
function updateMiniPetPanel() {
  const panel = document.getElementById('pet-mini-panel');
  if (panel) {
    const newPanel = document.createElement('div');
    newPanel.innerHTML = renderMiniPetPanel();
    const newEl = newPanel.firstElementChild;
    if (newEl) {
      newEl.id = 'pet-mini-panel';
      newEl.style.cursor = 'pointer';
      newEl.addEventListener('click', () => {
        window.location.hash = 'pet';
      });
      panel.replaceWith(newEl);
    }
  }
}

function updateGreeting() {
  const greeting = getGreeting();
  const dateEl = document.querySelector('.greeting-date');
  const msgEl = document.querySelector('.greeting-msg');
  if (dateEl) dateEl.textContent = greeting.dateLine;
  if (msgEl) msgEl.textContent = greeting.message;
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

function updateActiveTimer() {
  if (!activeTimer) return;
  const timerEl = document.getElementById(`timer-${activeTimer}`);
  if (timerEl) {
    const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    timerEl.textContent = formatTime(elapsed);
  }
}

// 宠物陪伴气泡
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
  }, 30000);
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

  let menu = document.getElementById('task-menu');
  if (menu) menu.remove();

  menu = document.createElement('div');
  menu.id = 'task-menu';
  menu.className = 'task-menu-dropdown';
  menu.innerHTML = `
    <button class="menu-item" id="menu-delete">🗑️ 删除任务</button>
  `;
  document.body.appendChild(menu);

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

// 数据变化时刷新列表 + 宠物面板
window.bus.on('data:changed', (key) => {
  if (!document.querySelector('#page-tasks.active')) return;

  if (key && (key.includes('tasks') || key.includes('challenges'))) {
    renderTaskList();
  }

  // 刷新迷你宠物面板
  if (key && (key.includes('pets') || key.includes('exp') || key.includes('energy'))) {
    updateMiniPetPanel();
  }
});
