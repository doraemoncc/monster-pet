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
  { id: 'deco_crown', name: '皇冠', emoji: '🎩', price: 100, category: 'deco', desc: '宠物头顶皇冠装饰' },
  { id: 'deco_scarf', name: '围巾', emoji: '🧣', price: 80, category: 'deco', desc: '宠物围巾装饰' },
  { id: 'deco_bow', name: '蝴蝶结', emoji: '🎀', price: 60, category: 'deco', desc: '宠物蝴蝶结装饰' }
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
  const items = shopCategory === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => i.category === shopCategory);

  grid.innerHTML = items.map(item => {
    const canAfford = coins >= item.price;
    const isOwned = item.category === 'deco' && ownedItems.includes(item.id);

    return `
      <div class="shop-item ${isOwned ? 'owned' : ''}">
        <div class="shop-item-icon">${item.emoji}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.desc}</div>
          <div class="shop-item-price ${canAfford ? '' : 'cant-afford'}">💰${item.price}</div>
        </div>
        <button class="btn btn-buy ${isOwned ? 'owned' : canAfford ? '' : 'disabled'}" 
                data-item-id="${item.id}" ${isOwned || !canAfford ? 'disabled' : ''}>
          ${isOwned ? '已拥有' : '购买'}
        </button>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.btn-buy:not(.owned):not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      buyShopItem(btn.dataset.itemId);
    });
  });
}

function buyShopItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  // 防重复点击：立刻禁用按钮
  const btn = document.querySelector(`.btn-buy[data-item-id="${itemId}"]`);
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;

  const result = window.store.buyItem(itemId);

  if (!result) {
    showToast('购买失败', 'warning');
    return;
  }

  if (result.success === false) {
    if (result.reason === 'no_coins') {
      showToast('星币不够哦，快去完成任务吧！', 'warning');
      // 按钮抖动
      const btn = document.querySelector(`.btn-buy[data-item-id="${itemId}"]`);
      if (btn) {
        btn.style.animation = 'shake 0.4s ease';
        setTimeout(() => btn.style.animation = '', 400);
      }
    } else if (result.reason === 'already_owned') {
      showToast('你已经拥有这个装饰了', 'info');
    }
    return;
  }

  // 购买成功
  if (result.type === 'egg') {
    const petNames = { cat: '小猫咪', fish: '小孔雀鱼', turtle: '小乌龟', luna: '露娜', fairy: '小精灵', octopus: '小章鱼' };
    showToast(`🎉 获得了一只${petNames[result.pet.type]}蛋！去宠物乐园看看吧~`, 'success');
  } else if (result.type === 'food') {
    showToast(`${item.emoji} ${item.name}喂食成功！`, 'success');
  } else if (result.type === 'deco') {
    showToast(`✨ ${item.name}购买成功！`, 'success');
  } else {
    showToast('购买成功！', 'success');
  }

  // 按钮变绿
  const btn = document.querySelector(`.btn-buy[data-item-id="${itemId}"]`);
  if (btn) {
    btn.textContent = '✅';
    btn.classList.add('success');
    btn.disabled = true;
    setTimeout(() => {
      renderShopGrid();
      // 更新余额
      const coinsEl = document.getElementById('shop-coins');
      if (coinsEl) coinsEl.textContent = window.store.get('user.coins');
      window.updateCoinDisplay && window.updateCoinDisplay();
    }, 1000);
  }
}

window.bus.on('page:enter', (pageName) => {
  if (pageName === 'shop') {
    renderShopPage();
  }
});
