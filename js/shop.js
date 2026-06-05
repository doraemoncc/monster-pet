/**
 * 星币商店
 * T8: 商品展示 + 购买逻辑
 */

const SHOP_ITEMS = [
  { id: 'egg_mystery', name: '神秘宠物蛋', emoji: '🥚', price: 300, category: 'egg', desc: '随机获得一种宠物蛋' },
  { id: 'food_cookie', name: '小饼干', emoji: '🍪', price: 3, category: 'food', desc: '饱食+30 心情+5 活力+5' },
  { id: 'food_bone', name: '超级肉骨头', emoji: '🍖', price: 10, category: 'food', desc: '饱食+50 心情+10 活力+5' },
  { id: 'food_cake', name: '梦幻蛋糕', emoji: '🍰', price: 15, category: 'food', desc: '饱食+20 心情+30 活力+20' },
  { id: 'food_candy', name: '能量糖果', emoji: '🍬', price: 5, category: 'food', desc: '饱食+5 心情+15 活力+30' },
  { id: 'food_shrimp', name: '小虾米', emoji: '🦐', price: 8, category: 'food', desc: '饱食+40 心情+10 活力+10' },
  { id: 'food_veg', name: '鲜嫩蔬菜', emoji: '🌿', price: 6, category: 'food', desc: '饱食+35 心情+5 活力+15' },
  { id: 'deco_crown',   name: '皇冠',    emoji: '🎩', price: 100, category: 'deco', forPets: ['cat','luna','fairy'],                   desc: '头顶金色皇冠' },
  { id: 'deco_scarf',   name: '围巾',    emoji: '🧣', price: 80,  category: 'deco', forPets: ['cat','turtle','luna','fairy','octopus'], desc: '温暖的小围巾' },
  { id: 'deco_bow',     name: '蝴蝶结',  emoji: '🎀', price: 60,  category: 'deco', forPets: ['cat','fairy'],                          desc: '可爱的蝴蝶结' },
  { id: 'deco_shell',   name: '贝壳项链',emoji: '🐚', price: 70,  category: 'deco', forPets: ['fish','octopus'],                       desc: '海洋风贝壳项链' },
  { id: 'deco_flower',  name: '小花冠',  emoji: '🌸', price: 50,  category: 'deco', forPets: ['fairy','cat'],                          desc: '鲜花编织的花冠' },
  { id: 'deco_glasses', name: '墨镜',    emoji: '🕶️', price: 90,  category: 'deco', forPets: ['cat','luna','octopus'],                 desc: '酷酷的墨镜' }
];

let shopCategory = 'all';

function renderShopPage() {
  const container = document.getElementById('page-shop');
  if (!container) return;

  const coins = window.store.get('user.coins');

  container.innerHTML = `
    <div class="shop-header">
      <div class="shop-balance">
        <span class="shop-coins-icon">💰</span>
        <span class="shop-coins-value" id="shop-coins">${coins}</span>
      </div>
    </div>

    <div class="shop-tabs" id="shop-tabs">
      <button class="shop-tab active" data-cat="all">全部</button>
      <button class="shop-tab" data-cat="egg">🥚 宠物蛋</button>
      <button class="shop-tab" data-cat="food">🍎 食物</button>
      <button class="shop-tab" data-cat="deco">✨ 装饰</button>
    </div>

    <div class="shop-grid" id="shop-grid"></div>
  `;

  container.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      shopCategory = tab.dataset.cat;
      renderShopGrid();
    });
  });

  renderShopGrid();
}

function renderShopGrid() {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  const coins = window.store.get('user.coins');
  const ownedItems = window.store.get('shopItems') || [];
  const activePet = window.store.getActivePet ? window.store.getActivePet() : null;
  const activePetType = activePet ? activePet.type : null;
  const items = shopCategory === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => i.category === shopCategory);

  grid.innerHTML = items.map(item => {
    const canAfford = coins >= item.price;
    const isOwned = item.category === 'deco' && ownedItems.includes(item.id);

    // 装饰品适配标签
    let fitTag = '';
    if (item.category === 'deco' && item.forPets && activePetType) {
      if (item.forPets.includes(activePetType)) {
        fitTag = `<span class="shop-fit-tag fit">✅ 适合</span>`;
      } else {
        const petNames = { cat:'猫咪', fish:'孔雀鱼', turtle:'乌龟', luna:'露娜', fairy:'精灵', octopus:'章鱼' };
        fitTag = `<span class="shop-fit-tag nofit">⚠️ 不适合${petNames[activePetType] || activePetType}</span>`;
      }
    }

    // 已拥有装饰品：显示"去装备"按钮
    const btnContent = isOwned ? '去装备 →' : '购买';
    const btnClass = isOwned ? 'btn btn-buy go-equip' : `btn btn-buy ${canAfford ? '' : 'disabled'}`;
    const btnDisabled = (!isOwned && !canAfford) ? 'disabled' : '';

    return `
      <div class="shop-item ${isOwned ? 'owned' : ''}">
        <div class="shop-item-icon">${item.emoji}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}${fitTag}</div>
          <div class="shop-item-desc">${item.desc}</div>
          <div class="shop-item-price ${canAfford ? '' : 'cant-afford'}">💰${item.price}</div>
        </div>
        <button class="${btnClass}" data-item-id="${item.id}" ${btnDisabled}>
          ${btnContent}
        </button>
      </div>
    `;
  }).join('');

  // 购买按钮
  grid.querySelectorAll('.btn-buy:not(.go-equip):not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      buyShopItem(btn.dataset.itemId);
    });
  });

  // 去装备按钮 → 跳转宠物乐园
  grid.querySelectorAll('.btn-buy.go-equip').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = 'pet';
    });
  });
}

function buyShopItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  // 防重复点击：立刻禁用按钮
  const btnEl = document.querySelector(`.btn-buy[data-item-id="${itemId}"]`);
  if (btnEl && btnEl.disabled) return;
  if (btnEl) btnEl.disabled = true;

  const result = window.store.buyItem(itemId);

  if (!result) {
    showToast('购买失败', 'warning');
    return;
  }

  if (result.success === false) {
    if (result.reason === 'no_coins') {
      showToast('星币不够哦，快去完成任务吧！', 'warning');
      // 按钮抖动
      const shakeBtn = document.querySelector(`.btn-buy[data-item-id="${itemId}"]`);
      if (shakeBtn) {
        shakeBtn.style.animation = 'shake 0.4s ease';
        setTimeout(() => shakeBtn.style.animation = '', 400);
      }
    } else if (result.reason === 'already_owned') {
      showToast('你已经拥有这个装饰了', 'info');
    }
    return;
  }

  // 购买成功
  if (result.type === 'egg') {
    // 弹出命名弹窗，弹窗关闭后统一刷新
    const successBtn = document.querySelector(`.btn-buy[data-item-id="${itemId}"]`);
    if (successBtn) {
      successBtn.textContent = '✅';
      successBtn.classList.add('success');
      successBtn.disabled = true;
    }
    showNamePetModal(result.pet, 'egg').then(() => {
      renderShopGrid();
      const coinsEl = document.getElementById('shop-coins');
      if (coinsEl) coinsEl.textContent = window.store.get('user.coins');
      window.updateCoinDisplay && window.updateCoinDisplay();
    });
  } else if (result.type === 'food') {
    showToast(`${item.emoji} ${item.name}喂食成功！`, 'success');
  } else if (result.type === 'deco') {
    showToast(`✨ ${item.name}购买成功！`, 'success');
  } else {
    showToast('购买成功！', 'success');
  }

  // 按钮变绿（非 egg 类型，egg 已在上方处理）
  if (result.type !== 'egg') {
    const successBtn = document.querySelector(`.btn-buy[data-item-id="${itemId}"]`);
    if (successBtn) {
      successBtn.textContent = '✅';
      successBtn.classList.add('success');
      successBtn.disabled = true;
      setTimeout(() => {
        renderShopGrid();
        // 更新余额
        const coinsEl = document.getElementById('shop-coins');
        if (coinsEl) coinsEl.textContent = window.store.get('user.coins');
        window.updateCoinDisplay && window.updateCoinDisplay();
      }, 1000);
    }
  }
}

window.bus.on('page:enter', (pageName) => {
  if (pageName === 'shop') {
    renderShopPage();
  }
});

// ===== 宠物命名弹窗 =====
// mode: 'egg' 购买时命名 / 'rename' 重新命名
window.showNamePetModal = function(pet, mode) {
  return new Promise((resolve) => {
    const petEmojis = { cat: '🐱', fish: '🐠', turtle: '🐢', luna: '🌙', fairy: '🧚', octopus: '🐙' };
    const defaultNames = { cat: '小猫咪', fish: '小孔雀鱼', turtle: '小乌龟', luna: '露娜', fairy: '小精灵', octopus: '小章鱼' };
    const emoji = petEmojis[pet.type] || '🐾';
    const defaultName = defaultNames[pet.type] || '小宠物';
    const currentName = (pet.name && pet.name !== defaultName) ? pet.name : '';
    const isEgg = mode === 'egg';

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    overlay.innerHTML = `
      <div class="modal name-pet-modal">
        <div class="name-pet-emoji">${isEgg ? '🥚' : emoji}</div>
        <div class="name-pet-title">${isEgg ? '给你的新宠物起个名字吧！' : '修改宠物名字'}</div>
        <div class="name-pet-subtitle">${isEgg ? '你获得了一只' + defaultName + '蛋' : ''}</div>
        <input type="text" class="input-field" id="name-pet-input" placeholder="${defaultName}" maxlength="12" value="${currentName}">
        <div class="name-pet-hint">最多 12 个字哦</div>
        <div class="name-pet-actions">
          <button class="btn btn-secondary" id="name-pet-skip">${isEgg ? '跳过' : '取消'}</button>
          <button class="btn btn-primary" id="name-pet-confirm">确认</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('name-pet-input');
    const confirmBtn = document.getElementById('name-pet-confirm');
    const skipBtn = document.getElementById('name-pet-skip');

    // 自动聚焦输入框
    setTimeout(() => { if (input) input.focus(); }, 100);

    function cleanup() {
      document.body.removeChild(overlay);
      resolve(true);
    }

    confirmBtn.addEventListener('click', () => {
      const name = (input.value || '').trim();
      if (name && name !== pet.name) {
        window.store.renamePet(pet.id, name);
        showToast(`${isEgg ? '🎉 ' : '✅ '}${name}${isEgg ? '来啦！' : ' 改名成功！'}`, 'success');
        // 更新 bus 事件，让宠物页面感知名称变化
        window.bus.emit('pet:renamed', { id: pet.id, name: name });
      } else if (isEgg) {
        showToast(`🎉 ${defaultName}来啦！`, 'success');
      }
      cleanup();
    });

    skipBtn.addEventListener('click', () => {
      if (isEgg) showToast(`🎉 ${defaultName}来啦！`, 'success');
      cleanup();
    });

    // 回车确认
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmBtn.click();
    });
  });
};
