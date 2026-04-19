/**
 * 家长面板
 * T9: 密码锁 + 任务管理 + 周计划 + 积分管理 + 系统设置
 */

let parentUnlocked = false;
let parentTab = 'overview';

function renderParentPage() {
  const container = document.getElementById('page-parent');
  if (!container) return;

  // 检查是否已解锁
  const unlockedAt = window.store.get('parentUnlockedAt');
  if (unlockedAt && Date.now() - new Date(unlockedAt).getTime() < 300000) {
    parentUnlocked = true;
  }

  if (!parentUnlocked) {
    renderPasswordLock(container);
    return;
  }

  renderParentContent(container);
}

// ===== 密码锁 =====
function renderPasswordLock(container) {
  container.innerHTML = `
    <div class="parent-lock">
      <div class="lock-icon">🔒</div>
      <div class="lock-title">家长面板</div>
      <div class="lock-subtitle">请输入密码</div>
      <div class="lock-dots" id="lock-dots">
        <span class="lock-dot"></span>
        <span class="lock-dot"></span>
        <span class="lock-dot"></span>
        <span class="lock-dot"></span>
      </div>
      <div class="lock-message" id="lock-message"></div>
      <div class="lock-keypad" id="lock-keypad">
        ${[1,2,3,4,5,6,7,8,9,'',0,'del'].map(k => {
          if (k === '') return '<div class="key-empty"></div>';
          if (k === 'del') return '<button class="key-btn key-del" data-key="del">⌫</button>';
          return `<button class="key-btn" data-key="${k}">${k}</button>`;
        }).join('')}
      </div>
    </div>
  `;

  let code = '';

  container.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (key === 'del') {
        code = code.slice(0, -1);
      } else if (code.length < 4) {
        code += key;
      }
      updateLockDots(code);
      if (code.length === 4) {
        verifyPassword(code);
      }
    });
  });
}

function updateLockDots(code) {
  const dots = document.querySelectorAll('#lock-dots .lock-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < code.length);
  });
  document.getElementById('lock-message').textContent = '';
}

function verifyPassword(code) {
  const password = window.store.get('parentPassword') || '0000';
  if (code === password) {
    parentUnlocked = true;
    window.store.set('parentUnlockedAt', new Date().toISOString());
    renderParentPage();
  } else {
    const dotsContainer = document.getElementById('lock-dots');
    dotsContainer.style.animation = 'shake 0.4s ease';
    document.getElementById('lock-message').textContent = '密码错误';
    document.getElementById('lock-message').style.color = '#EF5350';
    setTimeout(() => {
      dotsContainer.style.animation = '';
      updateLockDots('');
    }, 500);
  }
}

// ===== 家长面板内容 =====
function renderParentContent(container) {
  const user = window.store.get('user');
  const tasks = window.store.get('tasks') || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCompleted = tasks.filter(t => t.completedAt && t.completedAt.startsWith(todayStr));
  const todayCoins = todayCompleted.reduce((sum, t) => sum + ((t.coinsEarned?.total) || t.coins || 0), 0);
  const pet = window.store.getActivePet();

  container.innerHTML = `
    <div class="parent-header">
      <div class="parent-lock-btn" id="parent-relock" title="锁定">🔒</div>
      <div class="parent-greeting">家长面板</div>
    </div>

    <div class="parent-overview">
      <div class="overview-card">
        <div class="overview-stat">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${todayCompleted.length}</div>
          <div class="stat-label">今日完成</div>
        </div>
        <div class="overview-stat">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${todayCoins}</div>
          <div class="stat-label">今日星币</div>
        </div>
        <div class="overview-stat">
          <div class="stat-icon">🔥</div>
          <div class="stat-value">${user.streak || 0}</div>
          <div class="stat-label">连续打卡</div>
        </div>
        <div class="overview-stat">
          <div class="stat-icon">${pet ? (PET_TYPES[pet.type]?.emoji || '🐾') : '🐾'}</div>
          <div class="stat-value">${pet ? pet.name : '-'}</div>
          <div class="stat-label">${pet ? STAGE_NAMES[pet.stage] : '无宠物'}</div>
        </div>
      </div>
    </div>

    <div class="parent-tabs" id="parent-tabs">
      <button class="ptab active" data-tab="tasks">任务管理</button>
      <button class="ptab" data-tab="plan">📅 周计划</button>
      <button class="ptab" data-tab="coins">积分管理</button>
      <button class="ptab" data-tab="settings">设置</button>
      <button class="ptab" data-tab="data">💾 数据</button>
    </div>

    <div class="parent-content" id="parent-content"></div>
  `;

  document.getElementById('parent-relock').addEventListener('click', () => {
    parentUnlocked = false;
    renderParentPage();
  });

  container.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      parentTab = tab.dataset.tab;
      renderParentTabContent();
    });
  });

  renderParentTabContent();
}

function renderParentTabContent() {
  const content = document.getElementById('parent-content');
  if (!content) return;

  switch (parentTab) {
    case 'tasks': renderTaskManagement(content); break;
    case 'plan': renderWeeklyPlan(content); break;
    case 'coins': renderCoinsManagement(content); break;
    case 'settings': renderSettings(content); break;
    case 'data': renderDataManagement(content); break;
  }
}

// 任务管理
function renderTaskManagement(container) {
  const tasks = window.store.get('tasks') || [];
  container.innerHTML = `
    <div class="task-manage-list">
      ${tasks.map(task => {
        const cat = CATEGORIES[task.category] || CATEGORIES.other;
        return `
          <div class="tm-item ${task.enabled === false ? 'disabled' : ''}">
            <div class="tm-info">
              <span class="tm-title">${task.title}</span>
              <span class="tm-meta">${cat.emoji} 💰${task.coins} ${task.repeat === 'daily' ? '每天' : task.repeat === 'weekly' ? '每周' : '一次'}</span>
            </div>
            <div class="tm-actions">
              <label class="tm-toggle">
                <input type="checkbox" ${task.enabled !== false ? 'checked' : ''} data-task-id="${task.id}" />
                <span class="toggle-slider"></span>
              </label>
              <button class="tm-delete" data-task-id="${task.id}" title="删除">🗑️</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Toggle 启用/禁用
  container.querySelectorAll('.tm-toggle input').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const tasks = window.store.get('tasks');
      const task = tasks.find(t => t.id === toggle.dataset.taskId);
      if (task) {
        task.enabled = toggle.checked;
        window.store.set('tasks', tasks);
      }
    });
  });

  // 删除
  container.querySelectorAll('.tm-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await window.showConfirm('确定要删除这个任务吗？');
      if (confirmed) {
        const tasks = window.store.get('tasks').filter(t => t.id !== btn.dataset.taskId);
        window.store.set('tasks', tasks);
        renderParentTabContent();
        showToast('任务已删除', 'info');
      }
    });
  });
}

// 周计划（简化版）
function renderWeeklyPlan(container) {
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const todayIndex = new Date().getDay();
  const weeklyPlan = window.store.get('weeklyPlan') || {};

  container.innerHTML = `
    <div class="weekly-plan">
      ${dayNames.map((day, i) => {
        const dayPlan = weeklyPlan[i] || [];
        const isToday = i === todayIndex;
        return `
          <div class="wp-day ${isToday ? 'today' : ''}">
            <div class="wp-day-header">
              <span class="wp-day-name">周${day}</span>
              ${isToday ? '<span class="wp-today-badge">今天</span>' : ''}
              <span class="wp-count">${dayPlan.length}项</span>
            </div>
            <div class="wp-day-tasks">
              ${dayPlan.map((item, idx) => {
                const tpl = DEFAULT_TEMPLATES.find(t => t.id === item.templateId);
                return `
                  <div class="wp-task">
                    <span>${tpl?.title || item.templateId}</span>
                    <span class="wp-task-coins">💰${item.coins || '?'}</span>
                  </div>
                `;
              }).join('')}
              ${dayPlan.length === 0 ? '<div class="wp-empty">无安排</div>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 积分管理
function renderCoinsManagement(container) {
  const user = window.store.get('user');
  const history = (window.store.get('completedHistory') || []).slice(0, 10);

  container.innerHTML = `
    <div class="coins-manage">
      <div class="coins-balance">
        <div class="coins-label">当前星币</div>
        <div class="coins-big">💰 ${user.coins}</div>
      </div>
      <div class="coins-adjust">
        <button class="btn btn-coins-adj" id="coins-minus-10">-10</button>
        <button class="btn btn-coins-adj" id="coins-minus-1">-1</button>
        <input type="number" class="coins-input" id="coins-amount" value="1" min="1" max="100" />
        <button class="btn btn-coins-adj" id="coins-plus-1">+1</button>
        <button class="btn btn-coins-adj" id="coins-plus-10">+10</button>
      </div>
      <div class="coins-history">
        <div class="coins-history-title">最近完成记录</div>
        ${history.length === 0 ? '<div class="wp-empty">暂无记录</div>' : ''}
        ${history.map(h => `
          <div class="history-item">
            <span class="history-title">${h.title}</span>
            <span class="history-coins">💰${h.coins}</span>
            ${h.isEarlyBird ? '<span class="history-early">🌅</span>' : ''}
            ${h.duration ? `<span class="history-time">${Math.floor(h.duration/60)}分${h.duration%60}秒</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 加减星币
  ['coins-minus-10', 'coins-minus-1', 'coins-plus-1', 'coins-plus-10'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      const amount = parseInt(document.getElementById('coins-amount')?.value) || 1;
      const delta = id.includes('plus') ? amount : -amount;
      window.store.set('user.coins', Math.max(0, window.store.get('user.coins') + delta));
      renderCoinsManagement(container);
      window.updateCoinDisplay && window.updateCoinDisplay();
    });
  });
}

// 系统设置
function renderSettings(container) {
  const settings = window.store.get('settings') || {};
  const decaySpeed = settings.decaySpeed || 'normal';

  container.innerHTML = `
    <div class="settings-panel">
      <div class="setting-section">
        <div class="setting-title">🔒 修改密码</div>
        <div class="setting-row">
          <input type="password" class="setting-input" id="old-password" placeholder="旧密码" />
        </div>
        <div class="setting-row">
          <input type="password" class="setting-input" id="new-password" placeholder="新密码" />
        </div>
        <div class="setting-row">
          <input type="password" class="setting-input" id="confirm-password" placeholder="确认新密码" />
        </div>
        <button class="btn btn-setting" id="btn-change-pwd">确认修改</button>
      </div>

      <div class="setting-section">
        <div class="setting-title">⚡ 属性衰减速度</div>
        <div class="setting-row">
          <button class="btn btn-decay ${decaySpeed === 'slow' ? 'active' : ''}" data-speed="slow">宽松</button>
          <button class="btn btn-decay ${decaySpeed === 'normal' ? 'active' : ''}" data-speed="normal">正常</button>
          <button class="btn btn-decay ${decaySpeed === 'strict' ? 'active' : ''}" data-speed="strict">严格</button>
        </div>
      </div>

      <div class="setting-section">
        <div class="setting-title">🔑 AI API Key（可选）</div>
        <div class="setting-row">
          <input type="text" class="setting-input" id="ai-api-key" placeholder="sk-..." value="${settings.aiApiKey || ''}" />
        </div>
        <button class="btn btn-setting" id="btn-save-key">保存</button>
      </div>

      <div class="setting-section danger">
        <div class="setting-title">⚠️ 危险操作</div>
        <button class="btn btn-danger" id="btn-reset">重置所有数据</button>
      </div>
    </div>
  `;

  // 修改密码
  document.getElementById('btn-change-pwd')?.addEventListener('click', () => {
    const old = document.getElementById('old-password')?.value;
    const newPwd = document.getElementById('new-password')?.value;
    const confirm = document.getElementById('confirm-password')?.value;

    if (!old || !newPwd || !confirm) {
      showToast('请填写所有密码字段', 'warning');
      return;
    }
    if (old !== (window.store.get('parentPassword') || '0000')) {
      showToast('旧密码错误', 'warning');
      return;
    }
    if (newPwd !== confirm) {
      showToast('两次输入的新密码不一致', 'warning');
      return;
    }
    if (newPwd.length !== 4 || !/^\d{4}$/.test(newPwd)) {
      showToast('密码必须是4位数字', 'warning');
      return;
    }
    window.store.set('parentPassword', newPwd);
    showToast('密码修改成功！', 'success');
  });

  // 衰减速度
  container.querySelectorAll('.btn-decay').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = btn.dataset.speed;
      const settings = window.store.get('settings') || {};
      settings.decaySpeed = speed;
      window.store.set('settings', settings);
      renderSettings(container);
      showToast('衰减速度已更新', 'success');
    });
  });

  // AI Key
  document.getElementById('btn-save-key')?.addEventListener('click', () => {
    const key = document.getElementById('ai-api-key')?.value?.trim();
    const settings = window.store.get('settings') || {};
    settings.aiApiKey = key;
    window.store.set('settings', settings);
    showToast(key ? 'API Key 已保存' : 'API Key 已清除', 'success');
  });

  // 重置数据
  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    const confirmed = await window.showConfirm('确定要重置所有数据吗？此操作不可撤销！');
    if (confirmed) {
      window.store.reset();
      location.reload();
    }
  });
}

window.bus.on('page:enter', (pageName) => {
  if (pageName === 'parent') {
    parentUnlocked = false;
    renderParentPage();
  }
});
