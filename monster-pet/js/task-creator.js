/**
 * 任务创建流程
 * T6: 创建面板 + 步骤流程 + 保存模板
 */

let createStep = 0; // 0: 选分类, 1: 输入/选模板, 2: 确认
let creatingTask = {
  category: 'other',
  title: '',
  subtasks: [],
  deadline: null,
  repeat: 'once',
  coins: 5
};

function openTaskCreator() {
  createStep = 0;
  creatingTask = {
    category: 'other',
    title: '',
    subtasks: [],
    deadline: null,
    repeat: 'once',
    coins: 5
  };

  let overlay = document.getElementById('creator-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'creator-overlay';
  overlay.className = 'creator-overlay';
  document.body.appendChild(overlay);

  renderCreatorStep();
}

function renderCreatorStep() {
  const overlay = document.getElementById('creator-overlay');
  if (!overlay) return;

  if (createStep === 0) {
    overlay.innerHTML = `
      <div class="creator-panel">
        <div class="creator-step-indicator">
          <span class="step-dot active"></span>
          <span class="step-line"></span>
          <span class="step-dot"></span>
          <span class="step-line"></span>
          <span class="step-dot"></span>
        </div>
        <div class="creator-title">选择分类</div>
        <div class="category-grid">
          ${Object.entries(CATEGORIES).map(([key, cat]) => `
            <div class="category-card ${creatingTask.category === key ? 'selected' : ''}" 
                 data-category="${key}" style="border-color: ${cat.color}">
              <span class="category-icon">${cat.emoji}</span>
              <span class="category-name">${cat.name}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-creator-next" id="creator-next">下一步 →</button>
        <button class="btn btn-creator-cancel" id="creator-cancel">取消</button>
      </div>
    `;

    overlay.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => {
        creatingTask.category = card.dataset.category;
        renderCreatorStep();
      });
    });

  } else if (createStep === 1) {
    const cat = CATEGORIES[creatingTask.category] || CATEGORIES.other;
    const defaultTemplates = getTemplatesForCategory(creatingTask.category);
    const myTemplates = getMyTemplates(creatingTask.category);

    overlay.innerHTML = `
      <div class="creator-panel">
        <div class="creator-step-indicator">
          <span class="step-dot done"></span>
          <span class="step-line done"></span>
          <span class="step-dot active"></span>
          <span class="step-line"></span>
          <span class="step-dot"></span>
        </div>
        <div class="creator-title">输入或选择任务</div>
        <div class="creator-input-wrap">
          <textarea class="creator-input" id="creator-input" placeholder="描述你的任务...&#10;如：每天练琴30分钟、写数学作业然后复习英语">${creatingTask.title}</textarea>
          <button class="btn btn-parse" id="btn-parse" title="智能识别">🔍</button>
        </div>
        <div class="creator-templates">
          ${defaultTemplates.length > 0 ? `
            <div class="template-section">
              <div class="template-label">默认模板</div>
              <div class="template-list">
                ${defaultTemplates.map(t => `
                  <button class="template-chip" data-tpl-id="${t.id}">${t.title}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}
          ${myTemplates.length > 0 ? `
            <div class="template-section">
              <div class="template-label">我的模板</div>
              <div class="template-list">
                ${myTemplates.map(t => `
                  <button class="template-chip my" data-tpl-id="${t.id}">${t.title} <span class="my-tag">我的</span></button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="creator-buttons">
          <button class="btn btn-creator-back" id="creator-back">← 返回</button>
          <button class="btn btn-creator-next" id="creator-next">下一步 →</button>
        </div>
      </div>
    `;

    // 智能解析按钮
    document.getElementById('btn-parse').addEventListener('click', async () => {
      const input = document.getElementById('creator-input').value.trim();
      if (!input) return;

      // 先本地解析
      const localResult = parseTaskInput(input);
      if (localResult) {
        applyParseResult(localResult);
      }

      // 尝试 AI 解析（如果配置了 API Key）
      const apiKey = window.store.get('settings.aiApiKey');
      if (apiKey && localResult && localResult.confidence < 0.7) {
        showToast('AI 正在分析...', 'info');
        const aiResult = await parseTaskWithAI(input);
        if (aiResult && aiResult.confidence > localResult.confidence) {
          applyParseResult(aiResult);
        }
      }
    });

    // 模板点击
    overlay.querySelectorAll('.template-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tplId = chip.dataset.tplId;
        // 查找模板
        let tpl = DEFAULT_TEMPLATES.find(t => t.id === tplId);
        if (!tpl) {
          tpl = (window.store.get('myTemplates') || []).find(t => t.id === tplId);
        }
        if (tpl) {
          creatingTask.title = tpl.title;
          creatingTask.subtasks = (tpl.subtasks || []).map((s, i) => ({
            id: `st_${i}`,
            text: typeof s === 'string' ? s : (s.text || ''),
            done: false
          }));
          creatingTask.repeat = tpl.repeat || 'once';
          creatingTask.coins = tpl.coins || 5;
          const input = document.getElementById('creator-input');
          if (input) input.value = tpl.title;
          showToast(`已选择模板：${tpl.title}`, 'success');
        }
      });
    });

    // 返回
    document.getElementById('creator-back').addEventListener('click', () => {
      creatingTask.title = document.getElementById('creator-input')?.value || '';
      createStep = 0;
      renderCreatorStep();
    });

  } else if (createStep === 2) {
    overlay.innerHTML = `
      <div class="creator-panel creator-confirm">
        <div class="creator-step-indicator">
          <span class="step-dot done"></span>
          <span class="step-line done"></span>
          <span class="step-dot done"></span>
          <span class="step-line done"></span>
          <span class="step-dot active"></span>
        </div>
        <div class="creator-title">确认任务</div>
        <div class="confirm-card">
          <div class="confirm-row">
            <label>标题</label>
            <input type="text" class="confirm-input" id="confirm-title" value="${creatingTask.title}" />
          </div>
          <div class="confirm-row">
            <label>分类</label>
            <span class="confirm-cat" style="color:${(CATEGORIES[creatingTask.category] || {}).color}">
              ${(CATEGORIES[creatingTask.category] || {}).emoji || '📝'} ${(CATEGORIES[creatingTask.category] || {}).name || '其他'}
            </span>
          </div>
          <div class="confirm-row">
            <label>子任务</label>
            <div class="confirm-subtasks" id="confirm-subtasks">
              ${creatingTask.subtasks.map((s, i) => `
                <div class="confirm-subtask">
                  <input type="text" class="subtask-input" value="${s.text}" data-index="${i}" />
                  <button class="btn-remove-subtask" data-index="${i}">✕</button>
                </div>
              `).join('')}
              ${creatingTask.subtasks.length < 5 ? `
                <button class="btn-add-subtask" id="add-subtask">+ 添加子任务</button>
              ` : ''}
            </div>
          </div>
          <div class="confirm-row">
            <label>截止时间</label>
            <input type="datetime-local" class="confirm-input" id="confirm-deadline" />
          </div>
          <div class="confirm-row">
            <label>重复</label>
            <select class="confirm-select" id="confirm-repeat">
              <option value="once" ${creatingTask.repeat === 'once' ? 'selected' : ''}>一次</option>
              <option value="daily" ${creatingTask.repeat === 'daily' ? 'selected' : ''}>每天</option>
              <option value="weekly" ${creatingTask.repeat === 'weekly' ? 'selected' : ''}>每周</option>
            </select>
          </div>
          <div class="confirm-row">
            <label>星币奖励</label>
            <input type="number" class="confirm-input confirm-coins" id="confirm-coins" 
                   value="${creatingTask.coins}" min="1" max="20" />
          </div>
        </div>
        <div class="creator-buttons">
          <button class="btn btn-creator-back" id="creator-back">← 返回</button>
          <button class="btn btn-save-template" id="save-template">📌 保存为模板</button>
          <button class="btn btn-creator-create" id="creator-create">✅ 创建任务</button>
        </div>
      </div>
    `;

    // 添加子任务
    const addBtn = document.getElementById('add-subtask');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        creatingTask.subtasks.push({ id: `st_${Date.now()}`, text: '', done: false });
        creatingTask.title = document.getElementById('confirm-title')?.value || creatingTask.title;
        creatingTask.repeat = document.getElementById('confirm-repeat')?.value || creatingTask.repeat;
        creatingTask.coins = parseInt(document.getElementById('confirm-coins')?.value) || 5;
        renderCreatorStep();
      });
    }

    // 删除子任务
    overlay.querySelectorAll('.btn-remove-subtask').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        creatingTask.subtasks.splice(idx, 1);
        creatingTask.title = document.getElementById('confirm-title')?.value || creatingTask.title;
        creatingTask.repeat = document.getElementById('confirm-repeat')?.value || creatingTask.repeat;
        creatingTask.coins = parseInt(document.getElementById('confirm-coins')?.value) || 5;
        renderCreatorStep();
      });
    });

    // 返回
    document.getElementById('creator-back').addEventListener('click', () => {
      creatingTask.title = document.getElementById('confirm-title')?.value || '';
      creatingTask.repeat = document.getElementById('confirm-repeat')?.value || 'once';
      creatingTask.coins = parseInt(document.getElementById('confirm-coins')?.value) || 5;
      const deadEl = document.getElementById('confirm-deadline');
      if (deadEl && deadEl.value) {
        creatingTask.deadline = new Date(deadEl.value).toISOString();
      }
      createStep = 1;
      renderCreatorStep();
    });

    // 保存为模板
    document.getElementById('save-template').addEventListener('click', async () => {
      const title = document.getElementById('confirm-title')?.value || '';
      if (!title) {
        showToast('请输入任务标题', 'warning');
        return;
      }
      const confirmed = await window.showConfirm(`将"${title}"保存为模板？`);
      if (confirmed) {
        const tpl = {
          title,
          category: creatingTask.category,
          subtasks: creatingTask.subtasks.map(s => s.text),
          coins: creatingTask.coins,
          repeat: creatingTask.repeat
        };
        if (saveMyTemplate(tpl)) {
          showToast('模板已保存！', 'success');
        }
      }
    });

    // 创建任务
    document.getElementById('creator-create').addEventListener('click', () => {
      const title = document.getElementById('confirm-title')?.value?.trim();
      if (!title) {
        showToast('请输入任务标题', 'warning');
        return;
      }

      const tasks = window.store.get('tasks');
      const newTask = {
        id: 'task_' + Date.now(),
        title,
        category: creatingTask.category,
        subtasks: creatingTask.subtasks.map((s, i) => ({
          id: `st_${Date.now()}_${i}`,
          text: document.querySelector(`.subtask-input[data-index="${i}"]`)?.value || s.text,
          done: false
        })),
        deadline: (() => {
          const deadEl = document.getElementById('confirm-deadline');
          return deadEl?.value ? new Date(deadEl.value).toISOString() : creatingTask.deadline || null;
        })(),
        repeat: document.getElementById('confirm-repeat')?.value || creatingTask.repeat,
        coins: parseInt(document.getElementById('confirm-coins')?.value) || creatingTask.coins,
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
        lastResetDate: null
      };

      tasks.push(newTask);
      window.store.set('tasks', tasks);

      showToast('任务创建成功！', 'success');
      closeCreator();

      // 刷新任务列表
      renderTaskList();
    });
  }

  // 绑定通用按钮
  const nextBtn = document.getElementById('creator-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (createStep === 0) {
        createStep = 1;
      } else if (createStep === 1) {
        const input = document.getElementById('creator-input')?.value?.trim();
        if (!input) {
          showToast('请输入任务描述或选择模板', 'warning');
          return;
        }
        creatingTask.title = input;
        // 如果没有手动选择模板解析过子任务，自动解析
        if (creatingTask.subtasks.length === 0) {
          const result = parseTaskInput(input);
          if (result) {
            creatingTask.subtasks = result.subtasks;
            creatingTask.repeat = result.repeat;
            creatingTask.coins = result.suggestedCoins;
          }
        }
        createStep = 2;
      }
      renderCreatorStep();
    });
  }

  const cancelBtn = document.getElementById('creator-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeCreator);
  }

  // 遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCreator();
  });
}

function applyParseResult(result) {
  creatingTask.title = result.title;
  creatingTask.subtasks = result.subtasks;
  creatingTask.category = result.category || creatingTask.category;
  creatingTask.repeat = result.repeat || creatingTask.repeat;
  creatingTask.coins = result.suggestedCoins || creatingTask.coins;
  creatingTask.deadline = result.deadline || null;

  const input = document.getElementById('creator-input');
  if (input) input.value = result.title;

  const cat = CATEGORIES[result.category];
  if (cat) {
    showToast(`识别为${cat.emoji}${cat.name}分类`, 'info');
  }

  if (result.subtasks.length > 0) {
    showToast(`拆分为 ${result.subtasks.length} 个子任务`, 'info');
  }
}

function closeCreator() {
  const overlay = document.getElementById('creator-overlay');
  if (overlay) overlay.remove();
}

// ===== 创建面板样式 =====
function injectCreatorStyles() {
  if (document.getElementById('creator-styles')) return;

  const style = document.createElement('style');
  style.id = 'creator-styles';
  style.textContent = `
    .creator-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 200;
      animation: fadeIn 0.2s;
    }
    .creator-panel {
      background: var(--bg-cream, #FFF8E7);
      border-radius: 20px 20px 0 0;
      padding: 20px;
      width: 100%;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
      animation: slideUp 0.3s ease;
    }
    .creator-confirm { max-height: 85vh; }
    .creator-step-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-bottom: 16px;
    }
    .step-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #E0D5C8;
      transition: all 0.2s;
    }
    .step-dot.active { background: var(--accent-orange, #FF9A56); transform: scale(1.3); }
    .step-dot.done { background: #66BB6A; }
    .step-line {
      width: 30px; height: 2px;
      background: #E0D5C8;
      transition: background 0.2s;
    }
    .step-line.done { background: #66BB6A; }
    .creator-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-brown, #5D4037);
      text-align: center;
      margin-bottom: 16px;
    }
    .category-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .category-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 4px;
      border-radius: 12px;
      border: 2px solid #E0D5C8;
      background: white;
      cursor: pointer;
      transition: all 0.15s;
    }
    .category-card.selected {
      border-width: 2.5px;
      background: rgba(255,154,86,0.08);
    }
    .category-icon { font-size: 24px; }
    .category-name { font-size: 11px; color: var(--text-secondary, #8D6E63); font-weight: 500; }
    .creator-input-wrap {
      position: relative;
      margin-bottom: 12px;
    }
    .creator-input {
      width: 100%;
      min-height: 80px;
      padding: 12px;
      border: 2px solid #E0D5C8;
      border-radius: 12px;
      font-size: 15px;
      color: var(--text-brown, #5D4037);
      background: white;
      resize: vertical;
      font-family: inherit;
      box-sizing: border-box;
    }
    .creator-input:focus { outline: none; border-color: var(--accent-orange, #FF9A56); }
    .btn-parse {
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
    }
    .creator-templates { margin-bottom: 16px; }
    .template-section { margin-bottom: 10px; }
    .template-label { font-size: 12px; color: var(--text-secondary, #8D6E63); margin-bottom: 6px; font-weight: 600; }
    .template-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .template-chip {
      padding: 6px 12px;
      border: 1.5px solid #E0D5C8;
      border-radius: 16px;
      background: white;
      font-size: 12px;
      color: var(--text-brown, #5D4037);
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .template-chip.my { border-color: #FF9A56; background: rgba(255,154,86,0.05); }
    .template-chip:hover { border-color: var(--accent-orange, #FF9A56); }
    .my-tag { font-size: 10px; color: var(--accent-orange, #FF9A56); margin-left: 2px; }
    .creator-buttons {
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .btn-creator-back, .btn-creator-next, .btn-save-template, .btn-creator-create, .btn-creator-cancel {
      padding: 10px 16px;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .btn-creator-next {
      background: linear-gradient(135deg, #FF9A56, #FF6B35);
      color: white;
      flex: 1;
    }
    .btn-creator-cancel {
      background: #E0D5C8;
      color: var(--text-secondary, #8D6E63);
    }
    .btn-creator-back {
      background: #E0D5C8;
      color: var(--text-secondary, #8D6E63);
    }
    .btn-save-template {
      background: rgba(255,154,86,0.15);
      color: var(--accent-orange, #FF9A56);
    }
    .btn-creator-create {
      background: linear-gradient(135deg, #66BB6A, #43A047);
      color: white;
      flex: 1;
    }
    .confirm-card { margin-bottom: 16px; }
    .confirm-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 12px;
    }
    .confirm-row > label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #8D6E63);
      min-width: 65px;
      padding-top: 8px;
    }
    .confirm-input, .confirm-select {
      flex: 1;
      padding: 8px 12px;
      border: 1.5px solid #E0D5C8;
      border-radius: 10px;
      font-size: 14px;
      color: var(--text-brown, #5D4037);
      background: white;
      font-family: inherit;
    }
    .confirm-input:focus, .confirm-select:focus { outline: none; border-color: var(--accent-orange, #FF9A56); }
    .confirm-coins { width: 70px; text-align: center; }
    .confirm-cat { font-size: 15px; font-weight: 600; padding-top: 8px; }
    .confirm-subtasks { flex: 1; }
    .confirm-subtask { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
    .subtask-input {
      flex: 1;
      padding: 6px 10px;
      border: 1.5px solid #E0D5C8;
      border-radius: 8px;
      font-size: 13px;
      color: var(--text-brown, #5D4037);
      background: white;
      font-family: inherit;
    }
    .subtask-input:focus { outline: none; border-color: var(--accent-orange, #FF9A56); }
    .btn-remove-subtask {
      background: none;
      border: none;
      color: #EF5350;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 4px;
    }
    .btn-add-subtask {
      background: none;
      border: 1.5px dashed #E0D5C8;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      color: var(--text-secondary, #8D6E63);
      cursor: pointer;
      width: 100%;
    }
    .btn-add-subtask:hover { border-color: var(--accent-orange, #FF9A56); color: var(--accent-orange, #FF9A56); }
  `;
  document.head.appendChild(style);
}

// 覆盖任务中心的添加按钮
const originalAddHandler = null;

window.bus.on('page:enter', (pageName) => {
  if (pageName === 'tasks') {
    injectCreatorStyles();
    // 延迟绑定添加按钮
    requestAnimationFrame(() => {
      const addBtn = document.getElementById('btn-add-task');
      if (addBtn) {
        // 移除旧监听
        const newBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newBtn, addBtn);
        newBtn.addEventListener('click', openTaskCreator);
      }
    });
  }
});
