/**
 * 宠物乐园 - 互动功能（喂食/玩耍）+ 气泡语
 * T4: 渲染互动按钮到 T3 预留区域
 */

// 食物配置
const FOOD_ITEMS = {
  food_cookie: { name: '小饼干', emoji: '🍪', coins: 3, canEat: ['cat', 'fish', 'turtle', 'luna', 'fairy', 'octopus'] },
  food_bone:   { name: '超级肉骨头', emoji: '🍖', coins: 10, canEat: ['cat', 'turtle', 'luna'] },
  food_cake:   { name: '梦幻蛋糕', emoji: '🍰', coins: 15, canEat: ['cat', 'fairy', 'luna'] },
  food_candy:  { name: '能量糖果', emoji: '🍬', coins: 5, canEat: ['cat', 'octopus', 'fairy'] },
  food_shrimp: { name: '小虾米', emoji: '🦐', coins: 8, canEat: ['fish', 'octopus'] },
  food_veg:    { name: '鲜嫩蔬菜', emoji: '🌿', coins: 6, canEat: ['turtle'] }
};

// 偏好食物
const FAVORITE_FOOD = {
  cat: 'food_cake', fish: 'food_shrimp', turtle: 'food_veg',
  luna: 'food_bone', fairy: 'food_candy', octopus: 'food_shrimp'
};

// 玩耍互动配置
const PLAY_ACTIONS = [
  { id: 'throw_ball', icon: '🎾', name: '扔球球', mood: 25, energy: -10, exp: 3 },
  { id: 'bubbles', icon: '🫧', name: '吹泡泡', mood: 20, energy: -5, exp: 3 },
  { id: 'music', icon: '🎵', name: '音乐时间', mood: 15, energy: -15, exp: 3 }
];

// 气泡语库
const BUBBLE_MESSAGES = {
  encouragement: [
    '主人今天真棒！', '今天的你比昨天更厉害了！', '继续加油哦~',
    '你最棒了！', '我也要向主人学习！', '太厉害了吧！',
    '开心开心~', '主人好厉害呀！', '完成任务的感觉真棒！'
  ],
  taskReminder: [
    '还有任务没做完哦~', '加油加油，还有任务呢！', '主人，别忘了任务哦~'
  ],
  streakPraise: [
    '连续打卡好厉害！', '坚持就是胜利！', '每天都来好棒呀！'
  ],
  favoriteFood: [
    '哇！这个好好吃！', '最喜欢了！', '太美味了吧！', '还能再吃一个吗？'
  ],
  sickMessage: [
    '呜...我不舒服...', '主人帮帮我...', '想去完成任务...'
  ]
};

// ===== 初始化互动按钮 =====
function initPetInteraction() {
  const actionsEl = document.getElementById('pet-actions');
  if (!actionsEl) return;

  actionsEl.innerHTML = `
    <button class="btn btn-interaction" id="btn-feed" title="喂食">
      🍎 喂食
    </button>
    <button class="btn btn-interaction" id="btn-play" title="玩耍">
      🎮 玩耍
    </button>
  `;

  document.getElementById('btn-feed').addEventListener('click', openFoodPanel);
  document.getElementById('btn-play').addEventListener('click', onPlayClick);

  updateButtonStates();
  window.bus.on('data:changed', () => updateButtonStates());
}

// 更新按钮状态
function updateButtonStates() {
  const pet = window.store ? window.store.getActivePet() : null;
  const feedBtn = document.getElementById('btn-feed');
  const playBtn = document.getElementById('btn-play');
  if (!feedBtn || !playBtn) return;

  const coins = window.store ? window.store.get('user.coins') : 0;

  if (pet && pet.sick) {
    feedBtn.disabled = true;
    feedBtn.classList.add('disabled');
    playBtn.disabled = true;
    playBtn.classList.add('disabled');
    return;
  }

  // 喂食按钮：星币不足置灰
  feedBtn.disabled = coins < 3;
  feedBtn.classList.toggle('disabled', coins < 3);

  // 玩耍按钮：活力不足置灰
  playBtn.disabled = pet && (pet.energy || 0) < 10;
  playBtn.classList.toggle('disabled', pet && (pet.energy || 0) < 10);
}

// ===== 喂食面板 =====
function openFoodPanel() {
  const pet = window.store.getActivePet();
  if (!pet) return;

  if (pet.sick) {
    showToast('宠物生病了，快去完成任务帮它恢复吧！', 'warning');
    return;
  }

  // 创建食物面板遮罩
  let overlay = document.getElementById('food-panel-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'food-panel-overlay';
  overlay.className = 'food-panel-overlay';
  overlay.innerHTML = `
    <div class="food-panel">
      <div class="food-panel-title">选择食物 🍎</div>
      <div class="food-grid" id="food-grid"></div>
      <button class="btn btn-cancel" id="food-panel-close">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // 渲染可用食物
  const grid = document.getElementById('food-grid');
  const petType = pet.type;
  const available = Object.entries(FOOD_ITEMS)
    .filter(([, food]) => food.canEat.includes(petType))
    .map(([id, food]) => ({ id, ...food }));

  grid.innerHTML = available.map(food => {
    const canAfford = window.store.get('user.coins') >= food.coins;
    const isFavorite = FAVORITE_FOOD[petType] === food.id;
    return `
      <div class="food-item ${canAfford ? '' : 'locked'} ${isFavorite ? 'favorite' : ''}" 
           data-food-id="${food.id}" title="${food.name}${isFavorite ? ' (偏好食物！)' : ''}">
        <span class="food-emoji">${food.emoji}</span>
        <span class="food-name">${food.name}</span>
        <span class="food-coins">💰${food.coins}</span>
        ${!canAfford ? '<span class="food-lock">🔒</span>' : ''}
        ${isFavorite ? '<span class="food-star">⭐</span>' : ''}
      </div>
    `;
  }).join('');

  // 绑定点击
  grid.querySelectorAll('.food-item:not(.locked)').forEach(item => {
    item.addEventListener('click', () => {
      const foodId = item.dataset.foodId;
      selectFood(foodId);
      overlay.remove();
    });
  });

  // 关闭按钮
  document.getElementById('food-panel-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// 选择食物
function selectFood(foodId) {
  const result = window.store.feedPet(foodId);

  if (result === false) return; // store 内部已处理提示

  // 气泡语
  if (result && result.isFavorite) {
    showBubble(randomFrom(BUBBLE_MESSAGES.favoriteFood));
  } else {
    showBubble(randomFrom(BUBBLE_MESSAGES.encouragement));
  }

  // 更新按钮状态和 UI
  updateButtonStates();
  window.updateCoinDisplay && window.updateCoinDisplay();
  updateStatRings(window.store.getActivePet());
  updateExpBar(window.store.getActivePet());
}

// ===== 玩耍 =====
function onPlayClick() {
  const pet = window.store.getActivePet();
  if (!pet) return;

  if (pet.sick) {
    showToast('宠物生病了，快去完成任务帮它恢复吧！', 'warning');
    return;
  }

  if ((pet.energy || 0) < 10) {
    showToast('太累了，先休息一下吧~', 'warning');
    return;
  }

  const result = window.store.playWithPet();

  if (result === null) return; // store 内部已处理

  // 气泡语
  showBubble(`${result.icon} ${result.name}！${randomFrom(BUBBLE_MESSAGES.encouragement)}`);

  // 更新状态
  updateButtonStates();
  window.updateCoinDisplay && window.updateCoinDisplay();
  updateStatRings(window.store.getActivePet());
  updateExpBar(window.store.getActivePet());

  // 智能气泡：任务提醒 / 打卡鼓励
  smartBubble();
}

// ===== 气泡语系统 =====
function showBubble(text) {
  const bubble = document.getElementById('pet-bubble');
  if (!bubble) return;

  bubble.textContent = text;
  bubble.classList.add('show');

  // 3 秒后消失
  clearTimeout(showBubble._timer);
  showBubble._timer = setTimeout(() => {
    bubble.classList.remove('show');
  }, 3000);
}

// 智能气泡（任务提醒 / 打卡鼓励）
function smartBubble() {
  const roll = Math.random();

  // 打卡鼓励（20%）
  const streak = window.store.get('user.streak') || 0;
  if (streak > 0 && roll < 0.2) {
    setTimeout(() => {
      showBubble(`${randomFrom(BUBBLE_MESSAGES.streakPraise)} 连续${streak}天了！`);
    }, 3500);
    return;
  }

  // 任务提醒（50%）
  if (roll < 0.5) {
    const tasks = window.store.get('tasks') || [];
    const pending = tasks.filter(t => t.status === 'pending' && t.enabled !== false);
    if (pending.length > 0) {
      setTimeout(() => {
        showBubble(`还有 ${pending.length} 个任务没做完哦~`);
      }, 3500);
    }
  }
}

// ===== 食物面板样式注入（只注入一次） =====
function injectFoodPanelStyles() {
  if (document.getElementById('food-panel-styles')) return;

  const style = document.createElement('style');
  style.id = 'food-panel-styles';
  style.textContent = `
    .food-panel-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 200;
      animation: fadeIn 0.2s;
    }
    .food-panel {
      background: var(--bg-cream, #FFF8E7);
      border-radius: 20px 20px 0 0;
      padding: 20px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
      animation: slideUp 0.3s ease;
    }
    .food-panel-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-brown, #5D4037);
      margin-bottom: 16px;
      text-align: center;
    }
    .food-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .food-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 8px;
      border-radius: 12px;
      background: rgba(255,255,255,0.8);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      position: relative;
    }
    .food-item:hover:not(.locked) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .food-item:active:not(.locked) {
      transform: scale(0.95);
    }
    .food-item.locked {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .food-item.favorite {
      border: 2px solid #FFD54F;
      background: rgba(255,213,79,0.1);
    }
    .food-emoji {
      font-size: 28px;
    }
    .food-name {
      font-size: 11px;
      color: var(--text-brown, #5D4037);
      text-align: center;
      font-weight: 500;
    }
    .food-coins {
      font-size: 11px;
      color: var(--accent-orange, #FF9A56);
      font-weight: 600;
    }
    .food-lock {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 12px;
    }
    .food-star {
      position: absolute;
      top: 4px;
      left: 4px;
      font-size: 12px;
    }
    .btn-interaction {
      padding: 10px 28px;
      border: none;
      border-radius: 16px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s, opacity 0.15s;
      box-shadow: 0 3px 10px rgba(0,0,0,0.1);
    }
    .btn-interaction:nth-child(1) {
      background: linear-gradient(135deg, #FF9A56, #FF6B35);
      color: white;
    }
    .btn-interaction:nth-child(2) {
      background: linear-gradient(135deg, #66BB6A, #43A047);
      color: white;
    }
    .btn-interaction:hover:not(.disabled) {
      transform: translateY(-2px);
    }
    .btn-interaction:active:not(.disabled) {
      transform: scale(0.95);
    }
    .btn-interaction.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-cancel {
      width: 100%;
      padding: 10px;
      background: var(--bg-warm, #FFE8CC);
      border: none;
      border-radius: 12px;
      font-size: 15px;
      color: var(--text-brown, #5D4037);
      cursor: pointer;
      font-weight: 600;
    }
    .btn-cancel:hover {
      background: #FFD9B3;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ===== 工具函数 =====
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== 监听页面事件，注入互动按钮 =====
window.bus.on('page:enter', (pageName) => {
  if (pageName === 'pet') {
    injectFoodPanelStyles();
    // 延迟一帧确保 DOM 已渲染
    requestAnimationFrame(() => {
      initPetInteraction();
    });
  }
});
