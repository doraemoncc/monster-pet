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
function getWeekDates(offset = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
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

// 历史日期视图（只读）：selectedDate 不是今天。历史任务跨天已被重置，只展示信息与完成记录
function isHistoryView() {
  return dateKey(selectedDate) !== dateKey();
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ===== HTML 转义（用于书目名称等用户文本）=====
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 查询书目是否读完（实时从 readingBooks 读取）
function getBookFinished(bookId) {
  const books = window.store.get('readingBooks') || [];
  const b = books.find(x => x.id === bookId);
  return b ? !!b.finished : false;
}

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
  // ⚠️ completedAt 是 UTC ISO，必须用本地 dateKey 归档；
  //    startsWith(key) / slice(0,10) 在 GMT+8 早 8 点前会算成前一天
  const completedOnDay = history.filter(h => {
    if (!h || !h.completedAt) return false;
    const d = new Date(h.completedAt);
    return !isNaN(d.getTime()) && dateKey(d) === key;
  }).length;

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

  // 只在首次进入时初始化；点日期条选了历史日期后必须保留（历史视图只读）。
  // 「重新进入任务页默认回今天」由 page:enter 负责，不能在这里强制重置。
  if (!selectedDate) selectedDate = new Date();

  const weekDates = getWeekDates(0);
  const greeting = getGreeting();

  // 日翻页标注
  const selKey = dateKey(selectedDate);
  const todayKey = dateKey();
  const dayLabel = selKey === todayKey ? '今天' :
    (() => {
      const selDay = new Date(`${selKey}T00:00:00`);
      const todayDay = new Date(`${todayKey}T00:00:00`);
      const diff = Math.round((selDay - todayDay) / 86400000);
      if (diff === -1) return '昨天';
      if (diff === 1) return '明天';
      if (diff > 1 && diff <= 6) return `${diff}天后`;
      if (diff < -1 && diff >= -6) return `${Math.abs(diff)}天前`;
      return `${selectedDate.getMonth() + 1}/${selectedDate.getDate()}`;
    })();

  container.innerHTML = `
    <!-- 日期时间轴 -->
    <div class="task-date-bar-wrapper">
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
    </div>

    <!-- 日期切换标签 -->
    <div class="day-nav-label">
      <span class="day-nav-text" id="day-nav-text">${dayLabel}</span>
      ${selKey !== todayKey ? `<button class="day-nav-back" id="day-nav-today">回到今天</button>` : ''}
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
  `;

  // 回到今天
  const dayNavToday = document.getElementById('day-nav-today');
  if (dayNavToday) {
    dayNavToday.addEventListener('click', () => {
      selectedDate = new Date();
      renderTasksPage();
    });
  }

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

// ===== 已完成任务查看（只读；cv- 前缀，不混入 .task-card 事件绑定） =====
// ⚠️ 本地日期是本次最大坑：completedAt 是 UTC ISO，一律用 dateKey(new Date(...)) 归档，
//    绝不复用 toISOString().slice(0,10) / startsWith(key)（GMT+8 早 8 点前会算成前一天）。
//    tasks 跨天会被 resetRepeatTasks() 原地重置，历史唯一持久依据是 completedHistory。
let cvExpanded = false;
let cvRange = 'all';

function cvGetRecords() {
  const history = window.store.get('completedHistory') || [];
  return (Array.isArray(history) ? history : [])
    .filter(h => h && h.completedAt && !isNaN(new Date(h.completedAt).getTime()))
    .map(h => {
      const d = new Date(h.completedAt);
      return {
        ...h,
        _day: dateKey(d),
        _time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        _ts: d.getTime()
      };
    })
    .sort((a, b) => b._ts - a._ts)
    .slice(0, 200); // completedHistory 只增不减，渲染前必须限量
}

function cvFormatDuration(sec) {
  const n = Number(sec) || 0;
  if (n <= 0) return '';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  if (m === 0) return `${s}秒`;
  return s === 0 ? `${m}分` : `${m}分${s}秒`;
}

function cvRowHtml(h) {
  const cat = CATEGORIES[h.category] || CATEGORIES.other;
  const coins = Number(h.coins) || 0;
  const dur = cvFormatDuration(h.duration);
  return `
    <div class="cv-row">
      <span class="cv-time">${h._time}</span>
      <span class="cv-title">${escapeHtml(h.title || '任务')}</span>
      <span class="cv-cat" style="color:${cat.color}">${cat.emoji} ${cat.name}</span>
      <span class="cv-coins">💰${coins}</span>
      ${dur ? `<span class="cv-duration">${dur}</span>` : ''}
      ${h.isEarlyBird ? '<span class="cv-early" title="早鸟奖励">🌅</span>' : ''}
    </div>`;
}

function renderCompletedSection() {
  const d = selectedDate || new Date();
  const selKey = dateKey(d);
  const isTodayView = selKey === dateKey();
  const label = isTodayView ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`;
  let records = cvGetRecords().filter(h => h._day === selKey);
  if (currentCategory !== 'all') {
    records = records.filter(h => h.category === currentCategory);
  }
  const emptyText = isTodayView ? '今天还没有完成的任务' : `${label}没有完成记录`;
  const headText = records.length === 0
    ? `✅ ${emptyText}`
    : `✅ ${label}已完成 ${records.length} 项`;
  return `
    <div class="cv-section">
      <div class="cv-head">
        <button class="cv-toggle" id="cv-toggle" type="button">
          <span>${headText}</span>
          <span class="cv-arrow ${cvExpanded ? 'open' : ''}">⌄</span>
        </button>
        <button class="cv-all-btn" id="cv-all-btn" type="button">📋 全部记录</button>
      </div>
      ${cvExpanded ? `
        <div class="cv-body">
          ${records.length === 0
            ? `<div class="cv-empty">${emptyText}</div>`
            : records.map(cvRowHtml).join('')}
        </div>` : ''}
    </div>`;
}

function cvRangeCutoff() {
  if (cvRange === 'all') return null;
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  if (cvRange === 'today') return base;
  const days = Number(cvRange) || 7;
  base.setDate(base.getDate() - (days - 1));
  return base;
}

function cvRenderModalBody(overlay) {
  const body = overlay.querySelector('#cv-modal-body');
  if (!body) return;
  const cutoff = cvRangeCutoff();
  let records = cvGetRecords();
  if (cvRange === 'today') {
    records = records.filter(h => h._day === dateKey());
  } else if (cutoff) {
    records = records.filter(h => h._ts >= cutoff.getTime());
  }

  const groups = {};
  records.forEach(h => {
    if (!groups[h._day]) groups[h._day] = [];
    groups[h._day].push(h);
  });
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  if (days.length === 0) {
    body.innerHTML = '<div class="cv-empty">这段时间还没有完成记录</div>';
    return;
  }
  body.innerHTML = days.map(day => {
    const items = groups[day];
    const coins = items.reduce((sum, h) => sum + (Number(h.coins) || 0), 0);
    const parts = day.split('-').map(Number);
    const wd = WEEKDAY_LABELS[(new Date(parts[0], parts[1] - 1, parts[2]).getDay() + 6) % 7];
    return `
      <div class="cv-day-group">
        <div class="cv-day-head">
          <span>${parts[1]}/${parts[2]} 周${wd}</span>
          <span>${items.length} 项 · 💰${coins}</span>
        </div>
        ${items.map(cvRowHtml).join('')}
      </div>`;
  }).join('');
}

// 历史翻查走独立弹窗：日期条「非今天重置回今天」是既有 bug，本次不复用也不修它
function openCompletedHistoryModal(range) {
  if (range) cvRange = range;
  // 与 navigateTo 一致：清理残留门卫遮罩（z-index:1000），否则本弹窗会被盖住
  document.querySelectorAll('.guard-overlay:not(.unlock-celebration)').forEach(o => o.remove());
  document.querySelectorAll('.cv-overlay').forEach(o => o.remove());
  const overlay = document.createElement('div');
  overlay.className = 'overlay cv-overlay';
  overlay.innerHTML = `
    <div class="modal cv-modal">
      <button class="tpl-creator-close cv-x" id="cv-x" type="button">✕</button>
      <div class="cv-modal-head">📋 打卡流水</div>
      <div class="cv-range" id="cv-range">
        ${[['today', '今天'], ['7', '近7天'], ['30', '近30天'], ['all', '全部']]
          .map(([k, label]) => `<button class="cv-range-btn ${cvRange === k ? 'active' : ''}" data-cv-range="${k}" type="button">${label}</button>`)
          .join('')}
      </div>
      <div class="cv-modal-body" id="cv-modal-body"></div>
      <div class="cv-modal-foot">只读记录 · 最多显示最近 200 条</div>
    </div>`;
  document.body.appendChild(overlay);
  cvRenderModalBody(overlay);

  const close = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelector('#cv-x').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-cv-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      cvRange = btn.dataset.cvRange;
      overlay.querySelectorAll('[data-cv-range]').forEach(b => b.classList.toggle('active', b === btn));
      cvRenderModalBody(overlay);
    });
  });
}
window.openCompletedHistoryModal = openCompletedHistoryModal;

// ===== 渲染任务列表 =====
function renderTaskList() {
  const listEl = document.getElementById('tasks-list');
  if (!listEl) return;

  const tasks = window.store.get('tasks') || [];
  const selKey = dateKey(selectedDate);
  const todayKey = dateKey();

  // 过滤：只显示选中日期的任务
  let filtered = tasks.filter(t => {
    // 只显示非已完成
    if (t.status !== 'pending' && t.status !== 'active') return false;

    // 查看选中日期的任务：通过 lastResetDate 或 createdAt 匹配
    if (t.lastResetDate && t.lastResetDate === selKey) return true;
    if (t.createdAt && t.createdAt.startsWith(selKey)) return true;
    // 兜底：无日期标记的 pending 任务只在今天显示
    if (selKey === todayKey && !t.lastResetDate && !t.createdAt) return true;
    return false;
  });

  // 分类过滤
  if (currentCategory !== 'all') {
    filtered = filtered.filter(t => t.category === currentCategory);
  }

  // 挑战区块：只在「今天」视图 + 「全部」分类显示（挑战是跨天长期目标，不归属某一天/某分类）
  const showChallengeSection = (selKey === todayKey && currentCategory === 'all');
  // 兑换区与挑战区同条件显示（已完成挑战不在挑战列表里，但奖品照片仍要可见）
  const challengeHtml = showChallengeSection ? renderChallengeSection() : '';
  // 兑换资格是长期状态，不随选中日期消失（切到历史日期仍可查看/出示兑换券）
  const rewardHtml = (currentCategory === 'all') ? renderRewardClaimSection() : '';

  // 即使没有普通任务也要显示挑战区块，故不在此处 return
  const taskHtml = filtered.length === 0
    ? `<div class="tasks-empty">
        <div class="empty-icon">🐱</div>
        <p>${isHistoryView()
          ? '这天的任务已归档，往下看「✅ 已完成」记录吧~'
          : currentCategory !== 'all' ? '这个分类还没有任务~' : '没有待完成的任务，去逛逛商城吧~'}</p>
      </div>`
    : filtered.map(task => renderTaskCard(task)).join('');

  // 已完成只读折叠区：completed 任务绝不混进主列表，避免孩子再点一次完成
  const completedHtml = renderCompletedSection();
  listEl.innerHTML = taskHtml + completedHtml + challengeHtml + rewardHtml;

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

    // 全屏计时按钮
    const fullscreenBtn = card.querySelector('.timer-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        showTimerFullscreen(taskId);
      });
    }

    // 「选书」按钮（阅读任务）
    const pickBookBtn = card.querySelector('.task-book-pick-btn');
    if (pickBookBtn) {
      pickBookBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showReadingBookPicker();
      });
    }

    // 更多菜单
    const moreBtn = card.querySelector('.task-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTaskMenu(taskId);
      });
    }
  });

  // 挑战卡片事件（独立类名前缀，绝不与 .task-card 混用）
  listEl.querySelectorAll('.btn-ch-accept').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      acceptChallenge(btn.dataset.chId);
    });
  });
  listEl.querySelectorAll('.btn-ch-complete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      completeChallenge(btn.dataset.chId);
    });
  });
  listEl.querySelectorAll('.btn-ch-checkin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      checkInChallengeToday(btn.dataset.chId);
    });
  });
  const goAddCh = listEl.querySelector('#challenge-go-add');
  if (goAddCh) {
    goAddCh.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.openChallengesTab === 'function') window.openChallengesTab();
    });
  }

  // 实物奖励：缩略图看大图 / 兑换券（独立 rw- 前缀，不与 .task-card 混用）
  rwBindPhotoFallback(listEl);
  listEl.querySelectorAll('[data-rw-photo]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showRewardPhoto(el.dataset.rwPhoto, false);
    });
  });
  listEl.querySelectorAll('[data-rw-claim]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showRewardPhoto(btn.dataset.rwClaim, true);
    });
  });

  // 已完成任务查看（只读；独立 cv- 前缀，不碰 .task-card 循环）
  const cvToggle = listEl.querySelector('#cv-toggle');
  if (cvToggle) {
    cvToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      cvExpanded = !cvExpanded;
      renderTaskList();
    });
  }
  const cvAllBtn = listEl.querySelector('#cv-all-btn');
  if (cvAllBtn) {
    cvAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCompletedHistoryModal('all');
    });
  }
}

// ===== 挑战实物奖励：照片白名单 / 展示 / 兑换券 =====
// 只接受压缩后的图片 dataURL 或 http(s) 网址；拒绝 javascript: / svg / 其它协议，防注入
function rwSafePhoto(photo) {
  const v = typeof photo === 'string' ? photo.trim() : '';
  if (!v) return '';
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(v)) return v;
  if (/^https?:\/\/[^\s"'<>]+$/i.test(v)) return v;
  return '';
}

// 统一的图片节点渲染：无照片或非法值一律降级为 🎁 占位，绝不渲染 <img src="">
function rwPhotoHtml(photo, cls, alt) {
  const safe = rwSafePhoto(photo);
  return safe
    ? `<img class="${cls}" src="${escapeHtml(safe)}" alt="${escapeHtml(alt || '奖励照片')}" loading="lazy" />`
    : `<span class="${cls} rw-photo-empty">🎁</span>`;
}

// 图片加载失败 → 换成占位（对卡片、兑换区、弹窗统一处理）
function rwBindPhotoFallback(root) {
  root.querySelectorAll('img.rw-card-photo-img, img.rw-claim-photo-img, img.rw-photo-big-img').forEach(img => {
    img.addEventListener('error', () => {
      const ph = document.createElement('span');
      ph.className = img.className + ' rw-photo-empty';
      ph.textContent = '🎁';
      img.replaceWith(ph);
    });
  });
}

// ISO 时间 → 本地日期标签（避免 toISOString().slice(0,10) 在 GMT+8 早 8 点前算成前一天）
function rwDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 挑战卡片里的奖品预览块（点整块看大图）
function renderRewardCard(ch) {
  const rw = ch.physicalReward;
  if (!rw || !rw.name) return '';
  return `
    <div class="rw-card" data-rw-photo="${escapeHtml(ch.id)}">
      <div class="rw-card-photo">${rwPhotoHtml(rw.photo, 'rw-card-photo-img', rw.name)}</div>
      <div class="rw-card-info">
        <div class="rw-card-label">🎁 实物奖励</div>
        <div class="rw-card-name">${escapeHtml(rw.name)}</div>
        <div class="rw-card-status">🔒 完成挑战后解锁兑换</div>
      </div>
    </div>`;
}

// 完成后挑战卡片会消失 → 独立的兑换区承接「兑换实物奖励照片」
function renderRewardClaimSection() {
  const all = window.store.get('challenges') || [];
  const list = all.filter(ch =>
    ch.physicalReward && ch.physicalReward.name &&
    ch.redeemStatus && ch.redeemStatus !== 'none');
  if (list.length === 0) return '';
  list.sort((a, b) => (a.redeemStatus === 'pending' ? 0 : 1) - (b.redeemStatus === 'pending' ? 0 : 1));
  return `
    <div class="rw-claim-section">
      <div class="rw-claim-title">🎁 我的奖励兑换 <span class="rw-claim-count">${list.length}</span></div>
      <div class="rw-claim-list">
        ${list.map(ch => {
          const rw = ch.physicalReward;
          const redeemed = ch.redeemStatus === 'redeemed';
          const date = rwDateLabel(redeemed ? ch.redeemedAt : ch.completedAt);
          return `
          <div class="rw-claim-item ${redeemed ? 'redeemed' : ''}">
            <div class="rw-claim-photo">${rwPhotoHtml(rw.photo, 'rw-claim-photo-img', rw.name)}</div>
            <div class="rw-claim-info">
              <div class="rw-claim-name">${escapeHtml(rw.name)}</div>
              <div class="rw-claim-challenge">🏆 ${escapeHtml(ch.title || '')}</div>
              <div class="rw-claim-status">${redeemed
                ? `✅ 已兑换 · ${escapeHtml(date || '')}`
                : `🎉 待兑换 · 完成于 ${escapeHtml(date || '')}`}</div>
            </div>
            <button class="btn btn-setting rw-claim-btn" data-rw-claim="${escapeHtml(ch.id)}">查看兑换券</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// 奖品大图弹窗；claim=true 时额外显示兑换券信息
function showRewardPhoto(chId, claim) {
  const ch = (window.store.get('challenges') || []).find(c => c.id === chId);
  if (!ch || !ch.physicalReward || !ch.physicalReward.name) return;
  const rw = ch.physicalReward;
  const overlay = document.createElement('div');
  overlay.className = 'overlay rw-overlay';
  overlay.innerHTML = `
    <div class="modal rw-photo-modal">
      <button class="tpl-creator-close rw-photo-x" id="rw-photo-x">✕</button>
      <div class="rw-photo-modal-head">${claim ? '🎉 实物奖励兑换券' : '🎁 实物奖励'}</div>
      <div class="rw-photo-big">${rwPhotoHtml(rw.photo, 'rw-photo-big-img', rw.name)}</div>
      <div class="rw-photo-name">${escapeHtml(rw.name)}</div>
      ${rw.note ? `<div class="rw-photo-note">${escapeHtml(rw.note)}</div>` : ''}
      ${claim
        ? `<div class="rw-photo-meta">🏆 挑战：${escapeHtml(ch.title || '')}</div>
           <div class="rw-photo-meta">完成于 ${escapeHtml(rwDateLabel(ch.completedAt) || '—')}</div>
           <div class="rw-photo-tip">把这个给爸爸妈妈看，兑换实物奖励吧 🎁</div>`
        : '<div class="rw-photo-tip">完成挑战后就可以兑换啦 🔒</div>'}
      <button class="btn btn-setting" id="rw-photo-ok">知道啦</button>
    </div>`;
  document.body.appendChild(overlay);
  rwBindPhotoFallback(overlay);
  const close = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelector('#rw-photo-x').addEventListener('click', close);
  overlay.querySelector('#rw-photo-ok').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

// ===== 挑战任务：每日任务页展示 + 接受 / 完成 =====
// 挑战是独立数据（store.challenges），不写入 tasks，也不参与 isTodayAllDone()
// ⚠️ 严格判断 pushedToDaily === true：家长面板「挑战库」里的挑战（含老数据残留的示例）
//    默认不显示，只有家长显式「推送到每日任务」后才出现。不能用 truthy 兜底。
function getActiveChallenges() {
  return (window.store.get('challenges') || []).filter(ch => !ch.completed && ch.pushedToDaily === true);
}

// ===== 挑战每日进度：按本地日期记录打卡，展示进度条 / 连续天数 / 每日格子 =====
function getChallengeLog(ch) {
  return Array.isArray(ch.dailyLog) ? ch.dailyLog : [];
}

// 连续天数：今天已打卡从今天往前数；今天未打卡则从昨天往前数（今天还有机会补）
function getChallengeStreak(ch) {
  const log = new Set(getChallengeLog(ch));
  if (log.size === 0) return 0;
  const d = new Date();
  if (!log.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (log.has(dateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// 最近 N 天格子（N = min(max(targetDays,7),14)），以今天为最后一格；不显示未来
function renderChallengeDayGrid(ch) {
  const target = Number(ch.targetDays) || 0;
  const n = Math.min(Math.max(target > 0 ? target : 7, 7), 14);
  const log = new Set(getChallengeLog(ch));
  const todayStr = dateKey(new Date());
  const weeks = ['日', '一', '二', '三', '四', '五', '六'];
  let html = '';
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const done = log.has(key);
    const isToday = key === todayStr;
    html += `<div class="ch-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}">
        <span class="ch-day-week">${weeks[d.getDay()]}</span>
        <span class="ch-day-num">${d.getDate()}</span>
        <span class="ch-day-mark">${done ? '✓' : (isToday ? '○' : '·')}</span>
      </div>`;
  }
  return html;
}

function renderChallengeProgress(ch) {
  const target = Number(ch.targetDays) || 0;
  const done = getChallengeLog(ch).length;
  const streak = getChallengeStreak(ch);
  const reached = target > 0 && done >= target;
  const pct = target > 0 ? Math.min(100, Math.round(done / target * 100)) : 0;
  return `
    <div class="challenge-progress-box ${reached ? 'reached' : ''}">
      <div class="ch-progress-head">
        <span>${target > 0 ? `📅 进度 ${done} / ${target} 天` : `📅 已打卡 ${done} 天`}</span>
        <span>🔥 连续 ${streak} 天</span>
      </div>
      ${target > 0 ? `<div class="ch-progress-bar"><div class="ch-progress-fill" style="width:${pct}%"></div></div>` : ''}
      <div class="ch-day-grid">${renderChallengeDayGrid(ch)}</div>
      ${reached ? '<div class="ch-progress-reached">🎉 已达标！点「完成 ✓」领取奖励</div>' : ''}
    </div>`;
}

// 今天打卡（每天只记一次；达标仅高亮提示，不自动完成/发币）
function checkInChallengeToday(chId) {
  const list = window.store.get('challenges') || [];
  const ch = list.find(c => c.id === chId);
  if (!ch || ch.completed || ch.pushedToDaily !== true) return;
  const key = dateKey(new Date());
  if (!Array.isArray(ch.dailyLog)) ch.dailyLog = [];
  if (ch.dailyLog.includes(key)) return;
  ch.dailyLog.push(key);
  ch.dailyLog.sort();
  window.store.set('challenges', list);
  renderTaskList();
  const target = Number(ch.targetDays) || 0;
  const reached = target > 0 && ch.dailyLog.length >= target;
  showToast(reached
    ? '🎉 已达标！可以点「完成 ✓」领取奖励啦'
    : `今日打卡成功！已坚持 ${ch.dailyLog.length} 天 📅`, 'success');
}

function renderChallengeSection() {
  const list = getActiveChallenges();
  if (list.length === 0) {
    return `
      <div class="challenge-section">
        <div class="challenge-section-title">🏆 挑战任务</div>
        <div class="challenge-section-empty">
          还没有推送到每日任务的挑战，请家长到「家长面板 → 🏆 挑战」点「📤 推送」🎯
          <button class="btn btn-setting challenge-go-add" id="challenge-go-add">去推送挑战</button>
        </div>
      </div>`;
  }
  return `
    <div class="challenge-section">
      <div class="challenge-section-title">🏆 挑战任务 <span class="challenge-section-count">${list.length}</span></div>
      <div class="challenge-card-list">
        ${list.map(ch => {
          const checkedToday = getChallengeLog(ch).includes(dateKey(new Date()));
          return `
          <div class="challenge-card ${ch.accepted ? 'accepted' : ''}" data-ch-id="${escapeHtml(ch.id)}">
            <div class="challenge-card-head">
              <span class="challenge-card-status">${ch.accepted ? '🔄 进行中' : '🎯 今日挑战'}</span>
              <span class="challenge-card-reward">💰 +${Number(ch.bonusCoins) || 0}</span>
            </div>
            <div class="challenge-card-title">${escapeHtml(ch.title)}</div>
            <div class="challenge-card-desc">${escapeHtml(ch.description || '')}</div>
            ${renderRewardCard(ch)}
            ${renderChallengeProgress(ch)}
            <div class="challenge-card-actions">
              ${ch.accepted
                ? ''
                : `<button class="btn btn-ch-accept" data-ch-id="${escapeHtml(ch.id)}">接受挑战 ▶</button>`}
              <button class="btn btn-ch-checkin ${checkedToday ? 'done' : ''}" data-ch-id="${escapeHtml(ch.id)}" ${checkedToday ? 'disabled' : ''}>${checkedToday ? '今日已打卡 ✓' : '今日打卡 ✓'}</button>
              <button class="btn btn-ch-complete" data-ch-id="${escapeHtml(ch.id)}">完成 ✓</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function acceptChallenge(chId) {
  const list = window.store.get('challenges') || [];
  const ch = list.find(c => c.id === chId);
  if (!ch || ch.completed || ch.pushedToDaily !== true) return;
  ch.accepted = true;
  window.store.set('challenges', list);
  renderTaskList();
  showToast(`已接受挑战：${ch.title}`, 'success');
}

async function completeChallenge(chId) {
  const list = window.store.get('challenges') || [];
  const ch = list.find(c => c.id === chId);
  if (!ch || ch.completed || ch.pushedToDaily !== true) return;
  // 家长面板无法把已完成挑战标回未完成 → 完成不可逆，先二次确认
  const ok = await window.showConfirm(`确定完成挑战「${ch.title}」吗？\n将获得 💰${Number(ch.bonusCoins) || 0} 星币，完成后不能撤销。`);
  if (!ok) return;

  ch.completed = true;
  ch.completedAt = new Date().toISOString();
  // 实物奖励：完成挑战即获得兑换资格（星币照发，实物奖励不消耗星币）
  const hasReward = !!(ch.physicalReward && ch.physicalReward.name);
  if (hasReward && ch.redeemStatus === 'none') ch.redeemStatus = 'pending';
  // completed 与 redeemStatus 必须写在同一次 set 里，避免二次写入覆盖数据
  window.store.set('challenges', list);

  const reward = Number(ch.bonusCoins) || 0;
  window.store.set('user.coins', (window.store.get('user.coins') || 0) + reward);
  // 完成挑战/附加任务 → 奖励额外喂食+玩耍机会各1次（沿用既有机制）
  if (typeof window.store.grantBonusInteraction === 'function') window.store.grantBonusInteraction('both');
  window.updateCoinDisplay && window.updateCoinDisplay();

  renderTaskList();
  showToast(hasReward
    ? `🏆 挑战完成！获得 💰${reward} 星币 + 🎁 实物奖励兑换资格`
    : `🏆 挑战完成！获得 💰${reward} 星币`, 'success');
  if (hasReward) showRewardPhoto(chId, true);
}

// ===== 任务卡片中的「在读」书目（实时从书库读取，手动选择，读完自动退出）=====
function getReadingBooks() {
  return (window.store.get('readingBooks') || []).filter(b => b.reading && !b.finished);
}

function renderTaskBooks(task) {
  if (task.category !== 'reading') return '';
  const reading = getReadingBooks();
  const chips = reading.map(b => {
    const flag = b.lang === 'en' ? '🇬🇧' : '🇨🇳';
    return `<span class="task-book-chip ${b.lang}">${flag} 《${escapeHtml(b.title)}》</span>`;
  }).join('');
  const totalBooks = (window.store.get('readingBooks') || []).length;
  const hint = reading.length === 0
    ? (totalBooks === 0
        ? '<span class="task-book-empty">书库还是空的，先添加孩子在读的书吧 →</span>'
        : '<span class="task-book-empty">还没选在读书，点下面选一本 →</span>')
    : '';
  return `
    <div class="task-books">
      ${chips}${hint}
      <button class="task-book-pick-btn" data-task-id="${task.id}" title="选择在读的书">📖 选书</button>
    </div>`;
}

// ===== 任务卡片（改造版） =====
function renderTaskCard(task) {
  const cat = CATEGORIES[task.category] || CATEGORIES.other;
  const readOnly = isHistoryView(); // 历史日期不允许再点开始/完成/选书/计时
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
          <div class="task-card-meta">
            <span class="task-coins-badge">⚡${task.coins}</span>
          </div>
          ${isExpiring ? '<span class="task-alert">🔔</span>' : ''}
          ${isExpired ? '<span class="task-expired-tag">已过期</span>' : ''}
          ${readOnly ? '' : '<button class="task-more" title="更多">⋮</button>'}
        </div>
        <div class="task-title">${task.title}</div>
        ${readOnly ? '' : renderTaskBooks(task)}
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
          ${readOnly ? '<span class="task-history-badge">📅 历史只读</span>' : ''}
          ${!readOnly && isPending ? `<button class="btn btn-start">开始 ▶</button>` : ''}
          ${!readOnly && isActive && !hasSubtasks ? `<button class="btn btn-complete">完成 ✓</button>` : ''}
          ${!readOnly && isActive && hasSubtasks ? `<button class="btn btn-expand">${expandState(task.id) ? '收起 ▲' : '展开 ▼'}</button>` : ''}
          ${isCompleted ? '<span class="task-done-badge">✅ 已完成</span>' : ''}
        </div>
        ${isActive && !readOnly ? `
          <div class="task-timer">
            <span class="timer-display" id="timer-${task.id}">${formatTime(getElapsed(task))}</span>
            <span class="timer-pet-bubble" id="pet-bubble-${task.id}">📖 我陪你一起~</span>
            <button class="timer-fullscreen-btn" data-task-id="${task.id}" title="全屏计时">⛶</button>
          </div>
        ` : ''}
      </div>
      ${!readOnly && isActive && hasSubtasks && expandState(task.id) ? renderSubtasks(task) : ''}
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
let timerFullscreenEl = null; // 全屏计时器弹窗 DOM 引用

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

  // 自动弹出全屏计时器
  showTimerFullscreen(taskId);
}

function completeTask(taskId) {
  // 先关闭全屏计时器弹窗（如果存在）
  closeTimerFullscreen();

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

  // 检查是否全部完成 → 解锁商城和宠物乐园
  if (window.store.isTodayAllDone()) {
    window.store.setDailyUnlocked('shop');
    window.store.setDailyUnlocked('pet');
    window.updateNavUnlockState && window.updateNavUnlockState();
    // 延迟 2s 显示庆祝弹窗（等 showTaskResult 弹窗关闭后）
    setTimeout(() => {
      window.showUnlockCelebration && window.showUnlockCelebration();
    }, 2000);
  }

  // 检查是否为挑战/附加任务 → 奖励额外互动
  const task = window.store.get('tasks').find(t => t.id === taskId);
  if (task && (task.isChallenge || task.isExtra)) {
    window.store.grantBonusInteraction('both');
    showToast('🏆 完成特殊任务！获得额外喂食和玩耍机会各1次~', 'success');
  }

  // 阅读任务：完成后确认在读的书是否读完（在读列表实时从书库读取）
  if (task && task.category === 'reading' && getReadingBooks().length > 0) {
    showBookFinishedConfirm(task);
  }
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
  // 基于任务的 startedAt 绝对时间计算，而非会话内的 timerStartTime：
  // 页面隐藏/失焦时 setInterval 会被浏览器节流暂停，恢复后靠绝对时间可立即跳跃到正确值
  const task = window.store.get('tasks').find(t => t.id === activeTimer);
  if (!task || !task.startedAt) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 1000));
  const timeStr = formatTime(elapsed);

  // 更新卡片内嵌计时器
  const timerEl = document.getElementById(`timer-${activeTimer}`);
  if (timerEl) {
    timerEl.textContent = timeStr;
  }

  // 更新全屏弹窗计时器
  const fullscreenTimerEl = document.getElementById('fullscreen-timer-display');
  if (fullscreenTimerEl) {
    fullscreenTimerEl.textContent = timeStr;
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

// ===== 全屏计时器弹窗 =====
function showTimerFullscreen(taskId) {
  // 如果已有弹窗，先关闭
  closeTimerFullscreen();

  const task = window.store.get('tasks').find(t => t.id === taskId);
  if (!task) return;

  const cat = CATEGORIES[task.category] || CATEGORIES.other;
  const elapsed = task.startedAt ? Math.round((Date.now() - new Date(task.startedAt)) / 1000) : 0;
  const pet = window.store.getActivePet();
  const petEmoji = pet ? (pet.stage === 0 ? '🥚' : ((typeof PET_TYPES !== 'undefined') ? (PET_TYPES[pet.type] || PET_TYPES.cat).emoji : '🐱')) : '🐱';

  // 全屏气泡文字（更长间隔、更有趣）
  const fullscreenBubbles = [
    `${petEmoji} 我陪你一起~`, '💪 加油加油！', '😌 好安静呀~',
    '⏰ 时间在流逝...', '😸 一起学习！', '🤔 好难呀...',
    '🌟 你最棒了！', '📚 专注中...'
  ];

  const overlay = document.createElement('div');
  overlay.className = 'timer-fullscreen-overlay';
  overlay.innerHTML = `
    <div class="timer-fullscreen-container">
      <div class="timer-fs-header">
        <span class="timer-fs-category" style="background:${cat.color}20;color:${cat.color}">${cat.emoji} ${cat.name}</span>
        <button class="timer-fs-minimize" title="缩小">−</button>
      </div>
      <div class="timer-fs-title">${task.title}</div>
      <div class="timer-fs-pet">${petEmoji}</div>
      <div class="timer-fs-display" id="fullscreen-timer-display">${formatTime(elapsed)}</div>
      <div class="timer-fs-bubble" id="fullscreen-pet-bubble">${fullscreenBubbles[0]}</div>
      <button class="timer-fs-complete btn btn-complete" id="fullscreen-complete">完成 ✓</button>
    </div>
  `;

  document.body.appendChild(overlay);
  timerFullscreenEl = overlay;

  // 弹出动画
  requestAnimationFrame(() => overlay.classList.add('show'));

  // 立即用绝对时间刷新一次显示，避免恢复全屏瞬间的数字停留在旧值
  updateActiveTimer();

  // 全屏气泡轮换
  let bubbleIdx = 0;
  const bubbleInterval = setInterval(() => {
    if (!document.getElementById('fullscreen-pet-bubble')) {
      clearInterval(bubbleInterval);
      return;
    }
    bubbleIdx = (bubbleIdx + 1) % fullscreenBubbles.length;
    const bubbleEl = document.getElementById('fullscreen-pet-bubble');
    if (bubbleEl) {
      bubbleEl.style.opacity = '0';
      setTimeout(() => {
        bubbleEl.textContent = fullscreenBubbles[bubbleIdx];
        bubbleEl.style.opacity = '1';
      }, 200);
    }
  }, 15000);
  overlay._bubbleInterval = bubbleInterval;

  // 缩小按钮
  overlay.querySelector('.timer-fs-minimize').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTimerFullscreen();
  });

  // 完成按钮
  overlay.querySelector('#fullscreen-complete').addEventListener('click', (e) => {
    e.stopPropagation();
    completeTask(taskId);
  });

  // 点击遮罩不关闭（防止误操作）
}

function closeTimerFullscreen() {
  if (timerFullscreenEl) {
    if (timerFullscreenEl._bubbleInterval) {
      clearInterval(timerFullscreenEl._bubbleInterval);
    }
    // 立即移除，避免 300ms 延迟期间重开导致出现两个 fullscreen-timer-display
    // （getElementById 取到即将被删的旧节点，新弹窗数字就不更新了）
    timerFullscreenEl.remove();
    timerFullscreenEl = null;
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
  const isReading = task.category === 'reading' && getReadingBooks().length > 0;
  menu.innerHTML = `
    ${isReading ? `<button class="task-menu-item" id="menu-swap-book">📖 选择在读的书</button>` : ''}
    <div class="menu-hint">请在家长面板管理任务 📋</div>
  `;
  if (isReading) {
    menu.querySelector('#menu-swap-book').addEventListener('click', () => {
      menu.remove();
      showBookSwapPanel(taskId);
    });
  }
  document.body.appendChild(menu);

  const moreBtn = document.querySelector(`.task-card[data-task-id="${taskId}"] .task-more`);
  if (moreBtn) {
    const rect = moreBtn.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
  }

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

// ===== 选择在读的书（任务卡片入口，勾选的书显示在每日阅读任务里，读完自动退出）=====
function showReadingBookPicker() {
  if (typeof injectFoodPanelStyles === 'function') injectFoodPanelStyles();
  const allBooks = (window.store.get('readingBooks') || []).filter(b => !b.finished);
  const renderRows = () => {
    const groups = [
      { lang: 'cn', name: '🇨🇳 中文书' },
      { lang: 'en', name: '🇬🇧 英文书' }
    ];
    return groups.map(g => {
      const books = allBooks.filter(b => b.lang === g.lang);
      if (books.length === 0) return '';
      return `
        <div class="picker-group">
          <div class="picker-group-title">${g.name}</div>
          ${books.map(b => `
            <label class="picker-book-row ${b.reading ? 'selected' : ''}" data-id="${b.id}">
              <span class="picker-book-name">《${escapeHtml(b.title)}》</span>
              <span class="picker-check">${b.reading ? '✓ 在读' : '＋ 选为在读'}</span>
            </label>`).join('')}
        </div>`;
    }).join('');
  };

  const overlay = document.createElement('div');
  overlay.className = 'food-panel-overlay';
  const draw = () => {
    overlay.innerHTML = `
      <div class="food-panel book-picker-panel">
        <div class="food-panel-title">📖 选择正在读的书</div>
        <div class="picker-hint">勾选孩子当前在读的书，会显示在每日阅读任务里；读完在打卡时取消即可换下一本。</div>
        <div class="picker-book-list">${renderRows() || `
          <div class="picker-empty">
            <div>书库里还没有书 📚</div>
            <button class="btn btn-setting picker-go-add" id="picker-go-add">去添加书目</button>
          </div>`}</div>
        <button class="btn btn-cancel" id="picker-done">完成</button>
      </div>`;
    overlay.querySelectorAll('.picker-book-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const books = window.store.get('readingBooks') || [];
        const b = books.find(x => x.id === id);
        if (!b) return;
        b.reading = !b.reading;
        window.store.set('readingBooks', books);
        draw(); // 重绘选中态
      });
    });
    // 空书库引导：关闭面板并跳到家长面板的阅读书目 tab
    const goAdd = overlay.querySelector('#picker-go-add');
    if (goAdd) {
      goAdd.addEventListener('click', () => {
        overlay.remove();
        if (typeof window.openReadingBooksTab === 'function') window.openReadingBooksTab();
      });
    }
    overlay.querySelector('#picker-done').addEventListener('click', () => overlay.remove());
  };
  draw();
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// 兼容旧调用：菜单里的「更换今日书目」也走新选择器
function showBookSwapPanel(taskId) {
  showReadingBookPicker();
}

// ===== 完成任务后确认书目是否读完 =====
function showBookFinishedConfirm(task) {
  // 确保 food-panel 样式已注入（该样式原本由宠物互动面板懒加载，阅读确认弹窗也依赖它）
  if (typeof injectFoodPanelStyles === 'function') injectFoodPanelStyles();

  const allBooks = window.store.get('readingBooks') || [];
  // 在读列表实时从书库读取（用户手动勾选的书）
  const items = getReadingBooks().map(b => ({
    bookId: b.id, bookTitle: b.title, lang: b.lang, finished: false
  }));
  if (items.length === 0) return;

  const langName = { en: '🇬🇧', cn: '🇨🇳' };
  const overlay = document.createElement('div');
  overlay.className = 'food-panel-overlay';
  overlay.innerHTML = `
    <div class="food-panel book-finish-panel">
      <div class="food-panel-title">📚 今天的书读完了吗？</div>
      <div class="book-finish-list">
        ${items.map((b, i) => `
          <div class="book-finish-item" data-i="${i}">
            <span class="book-finish-name">${langName[b.lang] || ''} 《${escapeHtml(b.bookTitle)}》</span>
            <div class="book-finish-toggle">
              <button class="bf-btn ${b.finished ? 'active' : ''}" data-i="${i}" data-finished="1">读完了 ✓</button>
              <button class="bf-btn ${!b.finished ? 'active' : ''}" data-i="${i}" data-finished="0">还没</button>
            </div>
          </div>`).join('')}
      </div>
      <button class="btn btn-cancel" id="book-finish-confirm">确认</button>
    </div>`;
  document.body.appendChild(overlay);

  const state = items.map(b => b.finished);
  overlay.querySelectorAll('.bf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.i;
      state[i] = btn.dataset.finished === '1';
      const row = overlay.querySelector(`.book-finish-item[data-i="${i}"]`);
      row.querySelectorAll('.bf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  overlay.querySelector('#book-finish-confirm').addEventListener('click', () => {
    const books = window.store.get('readingBooks') || [];
    items.forEach((b, i) => {
      const book = books.find(x => x.id === b.bookId);
      if (book) {
        book.finished = state[i];
        // 读完 → 退出"在读"，任务卡片自动切到下一本在读书；点"还没"则保持在读
        if (state[i]) book.reading = false;
      }
    });
    window.store.set('readingBooks', books);
    // 一并关闭下方可能残留的"任务完成"结果弹窗，避免两层弹窗叠加
    document.querySelectorAll('.result-overlay').forEach(o => o.remove());
    overlay.remove();
    renderTaskList(); // 立即刷新卡片，在读书变化即时可见
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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

// 页面重新可见 / 窗口聚焦 / 全屏状态切换 / bfcache 恢复时，强制立即刷新计时显示。
// 浏览器在这些场景会节流甚至暂停 setInterval，仅靠 1s 定时器会导致「后台在计时但显示不动」。
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateActiveTimer(); });
window.addEventListener('focus', updateActiveTimer);
document.addEventListener('fullscreenchange', updateActiveTimer);
window.addEventListener('pageshow', updateActiveTimer);

// ===== 页面事件 =====
window.bus.on('page:enter', (pageName) => {
  if (pageName === 'tasks') {
    // 每次重新进入任务页默认回到今天；页内点日期条才切历史日期
    selectedDate = new Date();
    cvExpanded = false;
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

  if (key && (key.includes('tasks') || key.includes('challenges') || key.includes('completedHistory'))) {
    renderTaskList();
  }

  // 刷新迷你宠物面板
  if (key && (key.includes('pets') || key.includes('exp') || key.includes('energy'))) {
    updateMiniPetPanel();
  }
});
