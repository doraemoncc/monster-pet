/**
 * 家长面板
 * T9: 密码锁 + 任务管理 + 周计划 + 积分管理 + 系统设置
 */

let parentUnlocked = false;
let parentTab = 'task-mgmt';

function renderParentPage() {
  const container = document.getElementById('page-parent');
  if (!container) return;

  // 每次进入都要求密码（离开页面时已锁定）
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
      <button class="ptab active" data-tab="task-mgmt">任务管理</button>
      <button class="ptab" data-tab="plan">📅 周计划</button>
      <button class="ptab" data-tab="challenge">🏆 挑战</button>
      <button class="ptab" data-tab="earlybird">🌅 早鸟</button>
      <button class="ptab" data-tab="coins">💰 积分</button>
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
    case 'task-mgmt': renderTaskManagement(content); break;
    case 'plan': renderWeeklyPlan(content); break;
    case 'challenge': renderChallengeManagement(content); break;
    case 'earlybird': renderEarlyBirdSettings(content); break;
    case 'coins': renderCoinsManagement(content); break;
    default: renderTaskManagement(content);
  }
}

// ===== 任务管理（模板 + 添加任务，合并tab）=====
function renderTaskManagement(container) {
  container.innerHTML = `
    <div class="task-mgmt-subtabs">
      <button class="subtab active" data-subtab="templates">模板库</button>
      <button class="subtab" data-subtab="add-task">＋ 添加任务</button>
    </div>
    <div id="task-mgmt-content"></div>
  `;

  let currentSubtab = 'templates';

  function renderSubtab() {
    const sub = document.getElementById('task-mgmt-content');
    if (currentSubtab === 'templates') {
      renderTemplateManagement(sub);
    } else {
      renderAddTaskForm(sub);
    }
  }

  container.querySelectorAll('.subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSubtab = btn.dataset.subtab;
      renderSubtab();
    });
  });

  renderSubtab();
}

// 添加任务表单（临时/附加任务，不通过周计划）
function renderAddTaskForm(container) {
  container.innerHTML = `
    <div class="add-task-form">
      <div class="tpl-field">
        <label>任务名称</label>
        <input type="text" class="setting-input" id="add-task-title" placeholder="例：数学卷子" maxlength="30" />
      </div>
      <div class="tpl-field">
        <label>分类</label>
        <div class="tpl-cat-select" id="add-task-cat">
          ${Object.entries(CATEGORIES).map(([key, cat]) =>
            `<button class="tpl-cat-opt ${key === 'other' ? 'selected' : ''}" data-cat="${key}">${cat.emoji} ${cat.name}</button>`
          ).join('')}
        </div>
      </div>
      <div class="tpl-field">
        <label>星币奖励</label>
        <input type="number" class="setting-input" id="add-task-coins" value="5" min="1" max="99" />
      </div>
      <div class="tpl-field">
        <label>任务类型</label>
        <div class="tpl-cat-select" id="add-task-type">
          <button class="tpl-cat-opt selected" data-type="normal">普通任务</button>
          <button class="tpl-cat-opt" data-type="extra">📌 附加任务（完成奖励额外互动）</button>
        </div>
      </div>
      <button class="btn btn-setting" id="add-task-save" style="margin-top:12px">添加到今日任务</button>
    </div>
  `;

  let selectedCat = 'other';
  let selectedType = 'normal';

  container.querySelectorAll('#add-task-cat .tpl-cat-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#add-task-cat .tpl-cat-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCat = btn.dataset.cat;
    });
  });

  container.querySelectorAll('#add-task-type .tpl-cat-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#add-task-type .tpl-cat-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedType = btn.dataset.type;
    });
  });

  container.querySelector('#add-task-save').addEventListener('click', () => {
    const title = container.querySelector('#add-task-title').value.trim();
    if (!title) { showToast('请输入任务名称', 'warning'); return; }
    const coins = Math.max(1, Math.min(99, parseInt(container.querySelector('#add-task-coins').value) || 5));
    const todayStr = new Date().toISOString().slice(0, 10);

    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      category: selectedCat,
      subtasks: [],
      deadline: null,
      repeat: 'once',
      coins,
      estimatedMinutes: 0,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,
      completedAt: null,
      duration: null,
      isEarlyBird: false,
      coinsEarned: null,
      createdAt: new Date().toISOString(),
      lastResetDate: todayStr,
      isExtra: selectedType === 'extra',
      _templateId: null
    };

    const tasks = window.store.get('tasks') || [];
    tasks.push(newTask);
    window.store.set('tasks', tasks);

    showToast(`已添加「${title}」到今日任务~`, 'success');
    container.querySelector('#add-task-title').value = '';
  });
}

// ===== 挑战管理（家长面板内）=====
function renderChallengeManagement(container) {
  const challenges = window.store.get('challenges') || [];

  container.innerHTML = `
    <div class="challenge-manage">
      <div class="challenge-manage-hint">💡 挑战任务由家长设置，孩子在此查看并接受</div>
      <div class="challenge-manage-list">
        ${challenges.map((ch, idx) => `
          <div class="challenge-manage-item ${ch.completed ? 'completed' : ''}">
            <div class="challenge-manage-info">
              <div class="challenge-manage-title">${ch.completed ? '✅' : ch.accepted ? '🔄' : '🎯'} ${ch.title}</div>
              <div class="challenge-manage-desc">${ch.description}</div>
              <div class="challenge-manage-meta">
                <span class="challenge-manage-reward">💰 +${ch.bonusCoins}</span>
                ${ch.accepted && !ch.completed ? '<span class="challenge-status-badge">进行中</span>' : ''}
                ${ch.completed ? '<span class="challenge-status-badge done">已完成</span>' : ''}
              </div>
            </div>
            <div class="challenge-manage-actions">
              ${!ch.completed ? `<button class="tpl-edit-btn" data-ch-idx="${idx}" title="编辑">✏️</button>` : ''}
              <button class="tpl-delete-btn" data-ch-idx="${idx}" title="删除">🗑️</button>
            </div>
          </div>
        `).join('')}
        ${challenges.length === 0 ? '<div class="wp-empty">暂无挑战，点击下方添加</div>' : ''}
      </div>
      <button class="btn btn-add-template" id="btn-add-challenge" style="margin-top:12px">＋ 新建挑战</button>
    </div>
  `;

  // 新建挑战
  container.querySelector('#btn-add-challenge').addEventListener('click', () => {
    openChallengeEditor(null);
  });

  // 编辑挑战
  container.querySelectorAll('[data-ch-idx]').forEach(btn => {
    if (btn.classList.contains('tpl-edit-btn')) {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.chIdx);
        openChallengeEditor(idx);
      });
    }
  });

  // 删除挑战
  container.querySelectorAll('.tpl-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.chIdx);
      const confirmed = await window.showConfirm('确定删除这个挑战吗？');
      if (confirmed) {
        const chs = window.store.get('challenges') || [];
        chs.splice(idx, 1);
        window.store.set('challenges', chs);
        renderChallengeManagement(container);
        showToast('挑战已删除', 'info');
      }
    });
  });
}

// 挑战编辑弹窗
function openChallengeEditor(idx) {
  const challenges = window.store.get('challenges') || [];
  const ch = idx !== null ? challenges[idx] : null;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal tpl-creator-modal">
      <div class="tpl-creator-header">
        <h3>${ch ? '编辑挑战' : '新建挑战'}</h3>
        <button class="tpl-creator-close" id="ch-editor-close">✕</button>
      </div>
      <div class="tpl-creator-body">
        <div class="tpl-field">
          <label>挑战名称</label>
          <input type="text" class="setting-input" id="ch-title" value="${ch ? ch.title : ''}" placeholder="例：连续7天完成所有作业" maxlength="30" />
        </div>
        <div class="tpl-field">
          <label>挑战描述</label>
          <input type="text" class="setting-input" id="ch-desc" value="${ch ? ch.description : ''}" placeholder="描述挑战内容..." maxlength="60" />
        </div>
        <div class="tpl-field">
          <label>奖励星币</label>
          <input type="number" class="setting-input" id="ch-coins" value="${ch ? ch.bonusCoins : 20}" min="1" max="999" />
        </div>
        <button class="btn btn-setting" id="ch-editor-save">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('ch-editor-save').addEventListener('click', () => {
    const title = document.getElementById('ch-title').value.trim();
    const description = document.getElementById('ch-desc').value.trim();
    const bonusCoins = Math.max(1, parseInt(document.getElementById('ch-coins').value) || 20);

    if (!title) { showToast('请输入挑战名称', 'warning'); return; }

    const challenges = window.store.get('challenges') || [];
    if (ch && idx !== null) {
      challenges[idx] = { ...challenges[idx], title, description, bonusCoins };
    } else {
      challenges.push({
        id: 'ch_' + Date.now(),
        title, description, bonusCoins,
        accepted: false, completed: false,
        completedAt: null, weeklyReset: null,
        isChallenge: true
      });
    }
    window.store.set('challenges', challenges);
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
    showToast(ch ? '挑战已更新！' : '挑战已创建！', 'success');
    renderParentTabContent();
  });

  const close = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
  };
  document.getElementById('ch-editor-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// 任务模板管理
function renderTemplateManagement(container) {
  const allTemplates = getAllTemplates();

  container.innerHTML = `
    <div class="tpl-manage-header">
      <div class="tpl-manage-title">任务模板库</div>
      <button class="btn btn-add-template" id="btn-add-template">＋ 新建模板</button>
    </div>
    <div class="tpl-manage-list">
      ${allTemplates.map(tpl => {
        const cat = CATEGORIES[tpl.category] || CATEGORIES.other;
        const isCustom = !tpl.isDefault;
        return `
          <div class="tpl-item ${isCustom ? 'custom' : ''}" data-tpl-id="${tpl.id}">
            <div class="tpl-item-info">
              <span class="tpl-item-cat">${cat.emoji} ${cat.name}</span>
              <div class="tpl-item-title">${tpl.title}</div>
              <div class="tpl-item-meta">
                <span>💰${tpl.coins || 5}</span>
                <span>${tpl.repeat === 'daily' ? '每天' : tpl.repeat === 'weekly' ? '每周' : '一次'}</span>
                ${tpl.estimatedMinutes ? `<span>${tpl.estimatedMinutes}分钟</span>` : ''}
              </div>
            </div>
            <div class="tpl-item-actions">
              <button class="tpl-edit-btn" data-tpl-id="${tpl.id}" title="编辑">✏️</button>
              ${isCustom ? `<button class="tpl-delete-btn" data-tpl-id="${tpl.id}" title="删除">🗑️</button>` : ''}
            </div>
          </div>
        `;
      }).join('')}
      ${allTemplates.length === 0 ? '<div class="wp-empty">暂无模板，点击新建模板创建</div>' : ''}
    </div>
  `;

  // 新建模板
  document.getElementById('btn-add-template').addEventListener('click', () => {
    openTemplateCreator();
  });

  // 编辑模板
  container.querySelectorAll('.tpl-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tplId = btn.dataset.tplId;
      const tpl = findTemplate(tplId);
      if (tpl) openTemplateEditor(tpl);
    });
  });

  // 删除自定义模板
  container.querySelectorAll('.tpl-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await window.showConfirm('确定要删除这个自定义模板吗？');
      if (confirmed) {
        const tplId = btn.dataset.tplId;
        let myTemplates = window.store.get('myTemplates') || [];
        myTemplates = myTemplates.filter(t => t.id !== tplId);
        window.store.set('myTemplates', myTemplates);
        renderParentTabContent();
        showToast('模板已删除', 'info');
      }
    });
  });
}

// 编辑模板弹窗
function openTemplateEditor(tpl) {
  const isDefault = !!tpl.isDefault;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal tpl-creator-modal">
      <div class="tpl-creator-header">
        <h3>${isDefault ? '编辑默认模板（另存为自定义）' : '编辑模板'}</h3>
        <button class="tpl-creator-close" id="tpl-editor-close">✕</button>
      </div>
      <div class="tpl-creator-body">
        <div class="tpl-field">
          <label>任务名称</label>
          <input type="text" class="setting-input" id="tpl-edit-title" value="${tpl.title}" maxlength="20" />
        </div>
        <div class="tpl-field">
          <label>分类</label>
          <div class="tpl-cat-select" id="tpl-edit-cat-select">
            ${Object.entries(CATEGORIES).map(([key, cat]) =>
              `<button class="tpl-cat-opt ${key === tpl.category ? 'selected' : ''}" data-cat="${key}">${cat.emoji} ${cat.name}</button>`
            ).join('')}
          </div>
        </div>
        <div class="tpl-field">
          <label>星币奖励</label>
          <input type="number" class="setting-input" id="tpl-edit-coins" value="${tpl.coins || 5}" min="1" max="99" />
        </div>
        <div class="tpl-field">
          <label>重复方式</label>
          <div class="tpl-cat-select" id="tpl-edit-repeat-select">
            <button class="tpl-cat-opt ${tpl.repeat === 'daily' ? 'selected' : ''}" data-repeat="daily">每天</button>
            <button class="tpl-cat-opt ${tpl.repeat === 'weekly' ? 'selected' : ''}" data-repeat="weekly">每周</button>
            <button class="tpl-cat-opt ${tpl.repeat === 'once' ? 'selected' : ''}" data-repeat="once">一次</button>
          </div>
        </div>
        <div class="tpl-field">
          <label>预估时间（分钟，选填）</label>
          <input type="number" class="setting-input" id="tpl-edit-est" value="${tpl.estimatedMinutes || ''}" placeholder="15" min="1" max="120" />
        </div>
        ${isDefault ? '<div class="tpl-default-hint">💡 默认模板编辑后将另存为自定义模板，原模板保留</div>' : ''}
        <button class="btn btn-setting" id="tpl-editor-save">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let selectedCat = tpl.category || 'other';
  let selectedRepeat = tpl.repeat || 'daily';

  // 分类选择
  overlay.querySelectorAll('#tpl-edit-cat-select .tpl-cat-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('#tpl-edit-cat-select .tpl-cat-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCat = btn.dataset.cat;
    });
  });

  // 重复方式选择
  overlay.querySelectorAll('#tpl-edit-repeat-select .tpl-cat-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('#tpl-edit-repeat-select .tpl-cat-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedRepeat = btn.dataset.repeat;
    });
  });

  // 保存
  document.getElementById('tpl-editor-save').addEventListener('click', () => {
    const title = document.getElementById('tpl-edit-title').value.trim();
    if (!title) {
      showToast('请输入任务名称', 'warning');
      return;
    }
    const coins = Math.max(1, Math.min(99, parseInt(document.getElementById('tpl-edit-coins').value) || 5));
    const est = parseInt(document.getElementById('tpl-edit-est').value) || 0;

    const updatedTpl = {
      title,
      category: selectedCat,
      subtasks: tpl.subtasks || [],
      coins,
      estimatedMinutes: est,
      repeat: selectedRepeat
    };

    if (isDefault) {
      // 另存为自定义模板（用原 id 加 _override 后缀，或直接新 id）
      updatedTpl.id = 'my_override_' + tpl.id;
      updatedTpl.isDefault = false;
      const myTemplates = window.store.get('myTemplates') || [];
      // 若已有同 override id，覆盖
      const existIdx = myTemplates.findIndex(t => t.id === updatedTpl.id);
      if (existIdx >= 0) {
        myTemplates[existIdx] = updatedTpl;
      } else {
        myTemplates.push(updatedTpl);
      }
      window.store.set('myTemplates', myTemplates);
      showToast('已另存为自定义模板！', 'success');
    } else {
      // 直接修改自定义模板
      updatedTpl.id = tpl.id;
      updatedTpl.isDefault = false;
      const myTemplates = window.store.get('myTemplates') || [];
      const idx = myTemplates.findIndex(t => t.id === tpl.id);
      if (idx >= 0) {
        myTemplates[idx] = updatedTpl;
        window.store.set('myTemplates', myTemplates);
        showToast('模板已更新！', 'success');
      }
    }

    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
    renderParentTabContent();
  });

  // 关闭
  const close = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
  };
  document.getElementById('tpl-editor-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// 新建模板弹窗
function openTemplateCreator() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal tpl-creator-modal">
      <div class="tpl-creator-header">
        <h3>新建自定义模板</h3>
        <button class="tpl-creator-close" id="tpl-creator-close">✕</button>
      </div>
      <div class="tpl-creator-body">
        <div class="tpl-field">
          <label>任务名称</label>
          <input type="text" class="setting-input" id="tpl-new-title" placeholder="例：奥数练习" maxlength="20" />
        </div>
        <div class="tpl-field">
          <label>分类</label>
          <div class="tpl-cat-select" id="tpl-cat-select">
            ${Object.entries(CATEGORIES).map(([key, cat]) =>
              `<button class="tpl-cat-opt ${key === 'other' ? 'selected' : ''}" data-cat="${key}">${cat.emoji} ${cat.name}</button>`
            ).join('')}
          </div>
        </div>
        <div class="tpl-field">
          <label>星币奖励</label>
          <input type="number" class="setting-input" id="tpl-new-coins" value="5" min="1" max="99" />
        </div>
        <div class="tpl-field">
          <label>重复方式</label>
          <div class="tpl-cat-select" id="tpl-repeat-select">
            <button class="tpl-cat-opt selected" data-repeat="daily">每天</button>
            <button class="tpl-cat-opt" data-repeat="weekly">每周</button>
            <button class="tpl-cat-opt" data-repeat="once">一次</button>
          </div>
        </div>
        <div class="tpl-field">
          <label>预估时间（分钟，选填）</label>
          <input type="number" class="setting-input" id="tpl-new-est" placeholder="15" min="1" max="120" />
        </div>
        <button class="btn btn-setting" id="tpl-create-save">保存模板</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let selectedCat = 'other';
  let selectedRepeat = 'daily';

  // 分类选择
  overlay.querySelectorAll('#tpl-cat-select .tpl-cat-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('#tpl-cat-select .tpl-cat-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCat = btn.dataset.cat;
    });
  });

  // 重复方式选择
  overlay.querySelectorAll('#tpl-repeat-select .tpl-cat-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('#tpl-repeat-select .tpl-cat-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedRepeat = btn.dataset.repeat;
    });
  });

  // 保存
  document.getElementById('tpl-create-save').addEventListener('click', () => {
    const title = document.getElementById('tpl-new-title').value.trim();
    if (!title) {
      showToast('请输入任务名称', 'warning');
      return;
    }
    const coins = Math.max(1, Math.min(99, parseInt(document.getElementById('tpl-new-coins').value) || 5));
    const est = parseInt(document.getElementById('tpl-new-est').value) || 0;

    const template = {
      title,
      category: selectedCat,
      subtasks: [],
      coins,
      estimatedMinutes: est,
      repeat: selectedRepeat
    };

    if (saveMyTemplate(template)) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 200);
      showToast('模板已创建！', 'success');
      renderParentTabContent();
    }
  });

  // 关闭
  const close = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
  };
  document.getElementById('tpl-creator-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// 周计划（可编辑版）
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
          <div class="wp-day ${isToday ? 'today' : ''}" data-day="${i}">
            <div class="wp-day-header">
              <span class="wp-day-name">周${day}</span>
              ${isToday ? '<span class="wp-today-badge">今天</span>' : ''}
              <span class="wp-count">${dayPlan.length}项</span>
            </div>
            <div class="wp-day-tasks">
              ${dayPlan.map((item, idx) => {
                const tpl = findTemplate(item.templateId);
                const cat = tpl ? (CATEGORIES[tpl.category] || CATEGORIES.other) : null;
                return `
                  <div class="wp-task" data-day="${i}" data-idx="${idx}">
                    <div class="wp-task-info">
                      ${cat ? `<span class="wp-task-cat">${cat.emoji}</span>` : ''}
                      <span class="wp-task-title">${tpl?.title || item.templateId}</span>
                    </div>
                    <div class="wp-task-actions">
                      <span class="wp-task-coins" data-day="${i}" data-idx="${idx}" title="点击编辑星币">💰${item.coins || '?'}</span>
                      <button class="wp-task-del" data-day="${i}" data-idx="${idx}" title="删除">✕</button>
                    </div>
                  </div>
                `;
              }).join('')}
              ${dayPlan.length === 0 ? '<div class="wp-empty">无安排</div>' : ''}
            </div>
            <button class="wp-add-btn" data-day="${i}" title="添加任务">＋ 添加</button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // 绑定事件：添加任务
  container.querySelectorAll('.wp-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openTemplatePicker(parseInt(btn.dataset.day));
    });
  });

  // 绑定事件：删除任务
  container.querySelectorAll('.wp-task-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.dataset.day);
      const idx = parseInt(btn.dataset.idx);
      removePlanItem(day, idx);
    });
  });

  // 绑定事件：点击星币编辑
  container.querySelectorAll('.wp-task-coins').forEach(span => {
    span.addEventListener('click', () => {
      const day = parseInt(span.dataset.day);
      const idx = parseInt(span.dataset.idx);
      openCoinEditor(day, idx, span);
    });
  });
}

// 查找模板（优先从 store 用户模板，再从默认模板）
function findTemplate(templateId) {
  const myTemplates = window.store.get('myTemplates') || [];
  return myTemplates.find(t => t.id === templateId)
    || DEFAULT_TEMPLATES.find(t => t.id === templateId);
}

// 获取所有可用模板（去重合并）
function getAllTemplates() {
  const myTemplates = window.store.get('myTemplates') || [];
  const ids = new Set();
  const all = [];
  myTemplates.forEach(t => { if (!ids.has(t.id)) { ids.add(t.id); all.push(t); } });
  DEFAULT_TEMPLATES.forEach(t => { if (!ids.has(t.id)) { ids.add(t.id); all.push(t); } });
  return all;
}

// 从周计划中删除一条
function removePlanItem(dayIndex, itemIndex) {
  const weeklyPlan = window.store.get('weeklyPlan') || {};
  if (!weeklyPlan[dayIndex]) return;

  // 取出要删除的 templateId
  const removedItem = weeklyPlan[dayIndex][itemIndex];
  weeklyPlan[dayIndex].splice(itemIndex, 1);
  if (weeklyPlan[dayIndex].length === 0) delete weeklyPlan[dayIndex];
  window.store.set('weeklyPlan', weeklyPlan);

  // 如果删除的是今天的计划，同步删除今日对应任务（仅 pending 状态）
  const today = new Date().getDay();
  if (dayIndex === today && removedItem) {
    const todayStr = new Date().toISOString().slice(0, 10);
    let tasks = window.store.get('tasks') || [];
    tasks = tasks.filter(t =>
      !(t._templateId === removedItem.templateId &&
        t.lastResetDate === todayStr &&
        t.status === 'pending')
    );
    window.store.set('tasks', tasks);
  }

  renderParentTabContent();
  showToast('已移除', 'info');
}

// 打开模板选择弹窗
function openTemplatePicker(dayIndex) {
  const allTemplates = getAllTemplates();

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal wp-picker-modal">
      <div class="wp-picker-header">
        <h3>选择任务模板</h3>
        <button class="wp-picker-close" id="wp-picker-close">✕</button>
      </div>
      <div class="wp-picker-search">
        <input type="text" id="wp-search-input" class="wp-search-input" placeholder="搜索任务..." />
      </div>
      <div class="wp-picker-list" id="wp-picker-list">
        ${allTemplates.map(tpl => {
          const cat = CATEGORIES[tpl.category] || CATEGORIES.other;
          return `
            <div class="wp-picker-item" data-tpl-id="${tpl.id}" data-coins="${tpl.coins || 5}">
              <div class="wp-picker-item-info">
                <span class="wp-picker-cat">${cat.emoji}</span>
                <span class="wp-picker-title">${tpl.title}</span>
              </div>
              <div class="wp-picker-meta">
                <span class="wp-picker-coins">💰${tpl.coins || 5}</span>
                <span class="wp-picker-time">${tpl.estimatedMinutes ? tpl.estimatedMinutes + '分钟' : ''}</span>
              </div>
            </div>
          `;
        }).join('')}
        ${allTemplates.length === 0 ? '<div class="wp-empty">暂无模板，请先在任务中心创建</div>' : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 关闭
  const close = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
  };
  document.getElementById('wp-picker-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // 搜索过滤
  document.getElementById('wp-search-input').addEventListener('input', (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.wp-picker-item').forEach(item => {
      const title = item.querySelector('.wp-picker-title').textContent.toLowerCase();
      item.style.display = title.includes(keyword) ? '' : 'none';
    });
  });

  // 选择模板
  document.querySelectorAll('.wp-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const templateId = item.dataset.tplId;
      const coins = parseInt(item.dataset.coins) || 5;
      addPlanItem(dayIndex, templateId, coins);
      close();
    });
  });
}

// 添加一条到周计划
function addPlanItem(dayIndex, templateId, coins) {
  const weeklyPlan = window.store.get('weeklyPlan') || {};
  if (!weeklyPlan[dayIndex]) weeklyPlan[dayIndex] = [];
  weeklyPlan[dayIndex].push({ templateId, coins });
  window.store.set('weeklyPlan', weeklyPlan);

  // 如果添加的是今天的计划，立即生成任务
  const today = new Date().getDay();
  if (dayIndex === today && typeof applyWeeklyPlanNow === 'function') {
    applyWeeklyPlanNow(dayIndex);
  }

  const tpl = findTemplate(templateId);
  showToast(`已添加「${tpl?.title || templateId}」`, 'success');
  renderParentTabContent();
}

// 打开星币编辑（内联编辑）
function openCoinEditor(dayIndex, itemIndex, spanEl) {
  const weeklyPlan = window.store.get('weeklyPlan') || {};
  const item = weeklyPlan[dayIndex]?.[itemIndex];
  if (!item) return;

  const currentCoins = item.coins || 5;
  const rect = spanEl.getBoundingClientRect();

  // 创建内联编辑浮层
  const editor = document.createElement('div');
  editor.className = 'wp-coin-editor';
  editor.style.position = 'fixed';
  editor.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';
  editor.style.top = (rect.bottom + 4) + 'px';
  editor.style.zIndex = '200';
  editor.innerHTML = `
    <input type="number" class="wp-coin-input" value="${currentCoins}" min="1" max="99" />
    <button class="wp-coin-ok">✓</button>
  `;

  document.body.appendChild(editor);
  const input = editor.querySelector('.wp-coin-input');
  input.focus();
  input.select();

  const save = () => {
    const newCoins = Math.max(1, Math.min(99, parseInt(input.value) || 5));
    item.coins = newCoins;
    window.store.set('weeklyPlan', weeklyPlan);
    editor.remove();
    renderParentTabContent();
  };

  editor.querySelector('.wp-coin-ok').addEventListener('click', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') editor.remove();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (document.body.contains(editor)) save(); }, 150);
  });
}

// 早鸟设置
function renderEarlyBirdSettings(container) {
  const earlyBirdConfig = window.store.get('earlyBirdConfig') || {};
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  container.innerHTML = `
    <div class="earlybird-panel">
      <div class="earlybird-desc">
        <div class="earlybird-desc-icon">🌅</div>
        <div class="earlybird-desc-text">
          早鸟奖励：在截止时间前开始任务，完成时额外获得 <strong>+3 星币</strong> 奖励！
        </div>
      </div>
      <div class="earlybird-list">
        ${dayNames.map((name, i) => {
          const config = earlyBirdConfig[i] || { enabled: false, time: '07:00' };
          return `
            <div class="earlybird-item" data-day="${i}">
              <div class="earlybird-item-left">
                <span class="earlybird-day-name">${name}</span>
              </div>
              <div class="earlybird-item-right">
                <label class="tm-toggle eb-toggle">
                  <input type="checkbox" ${config.enabled ? 'checked' : ''} data-day="${i}" />
                  <span class="toggle-slider"></span>
                </label>
                <input type="time" class="earlybird-time-input" value="${config.time || '07:00'}" data-day="${i}" ${!config.enabled ? 'disabled' : ''} />
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 绑定 toggle
  container.querySelectorAll('.eb-toggle input').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const day = parseInt(toggle.dataset.day);
      const earlyBirdConfig = window.store.get('earlyBirdConfig') || {};
      if (!earlyBirdConfig[day]) earlyBirdConfig[day] = { enabled: false, time: '07:00' };
      earlyBirdConfig[day].enabled = toggle.checked;
      window.store.set('earlyBirdConfig', earlyBirdConfig);
      renderEarlyBirdSettings(container);
      showToast(toggle.checked ? '已开启早鸟奖励' : '已关闭早鸟奖励', 'info');
    });
  });

  // 绑定时间输入
  container.querySelectorAll('.earlybird-time-input').forEach(input => {
    input.addEventListener('change', () => {
      const day = parseInt(input.dataset.day);
      const earlyBirdConfig = window.store.get('earlyBirdConfig') || {};
      if (!earlyBirdConfig[day]) earlyBirdConfig[day] = { enabled: true, time: '07:00' };
      earlyBirdConfig[day].time = input.value;
      window.store.set('earlyBirdConfig', earlyBirdConfig);
      showToast('截止时间已更新', 'success');
    });
  });
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
