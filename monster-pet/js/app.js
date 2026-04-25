/**
 * 主应用入口：路由、事件总线、Service Worker 注册
 */

// ===== EventEmitter 事件总线 =====
class EventEmitter {
  constructor() {
    this._events = {};
  }

  on(event, listener) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (!this._events[event]) return this;
    this._events[event] = this._events[event].filter(l => l !== listener);
    return this;
  }

  emit(event, ...args) {
    if (!this._events[event]) return this;
    this._events[event].forEach(listener => listener(...args));
    return this;
  }
}

// 全局事件总线
window.bus = new EventEmitter();

// ===== 路由 =====
const pages = {
  pet: document.getElementById('page-pet'),
  tasks: document.getElementById('page-tasks'),
  shop: document.getElementById('page-shop'),
  parent: document.getElementById('page-parent')
};

let currentPage = null;

function hideAllPages() {
  Object.values(pages).forEach(p => p.classList.remove('active'));
}

function showPage(pageName) {
  // 触发页面离开事件
  if (currentPage) {
    window.bus.emit('page:leave', currentPage);
  }

  // 隐藏所有页面，显示目标页面
  hideAllPages();
  currentPage = pageName;
  pages[pageName].classList.add('active');

  // 触发页面进入事件（渲染内容）
  window.bus.emit('page:enter', pageName);

  // 内容渲染完成后再重置滚动位置
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
  });
}

function navigateTo(pageName) {
  if (pageName === currentPage) return;

  // ===== 门卫逻辑：每天第一次打开时锁住商城和宠物乐园 =====
  if (window.store && (pageName === 'shop' || pageName === 'pet')) {
    const isUnlocked = window.store.isDailyUnlocked(pageName === 'shop' ? 'shop' : 'pet');
    if (!isUnlocked) {
      // 检查今天是否已完成所有任务
      if (!window.store.isTodayAllDone()) {
        showShopGuard(pageName);
        return;
      }
      // 所有任务完成，标记解锁
      window.store.setDailyUnlocked(pageName === 'shop' ? 'shop' : 'pet');
    }
  }

  // 切换页面
  showPage(pageName);

  // 更新导航栏高亮
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });
}

// ===== 门卫弹窗（商城 / 宠物乐园）=====
function showShopGuard(targetPage) {
  const isShop = targetPage === 'shop';
  const icon = isShop ? '🏪' : '🎡';
  const placeName = isShop ? '星币商城' : '宠物乐园';

  const encouragements = [
    `完成今天的任务才能进入${placeName}哦，加油！💪`,
    `还有任务没完成呢，做完任务再来吧~ 🐾`,
    `先做完今天的任务，${placeName}的大门就为你打开！🌟`,
    `加油鸭！任务全部完成后${placeName}等着你！🐱`,
  ];
  const msg = encouragements[Math.floor(Math.random() * encouragements.length)];

  const overlay = document.createElement('div');
  overlay.className = 'guard-overlay';
  overlay.innerHTML = `
    <div class="guard-card">
      <div class="guard-icon">${icon}</div>
      <div class="guard-title">等一下~</div>
      <div class="guard-message">${msg}</div>
      <div class="guard-actions">
        <button class="btn btn-guard-go" id="guard-go-tasks">去做任务 💪</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('guard-go-tasks').addEventListener('click', () => {
    overlay.remove();
    window.location.hash = 'tasks';
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// 监听导航点击
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    if (page) {
      window.location.hash = page;
    }
  });
});

// 监听 hash 变化
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1); // 去掉 #
  if (hash && pages[hash]) {
    navigateTo(hash);
  }
});

// 初始化路由
function initRouter() {
  const hash = window.location.hash.slice(1) || 'pet';
  // currentPage 初始为 null，navigateTo 会在 showPage 中 hideAllPages 确保清除 HTML 初始 active
  navigateTo(hash);
}

// ===== 全局 Toast =====
window.showToast = function(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  // 3 秒后移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
};

// ===== 全局确认弹窗 =====
window.showConfirm = function(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    
    msgEl.textContent = message;
    overlay.classList.remove('hidden');
    
    function cleanup() {
      overlay.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    }
    
    function onOk() {
      cleanup();
      resolve(true);
    }
    
    function onCancel() {
      cleanup();
      resolve(false);
    }
    
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
};

// ===== 更新星币显示 =====
window.updateCoinDisplay = function() {
  const el = document.getElementById('coin-count');
  if (el && window.store) {
    el.textContent = window.store.get('user.coins');
  }
  // 弹跳动画
  const coinsEl = document.getElementById('nav-coins');
  if (coinsEl) {
    coinsEl.classList.remove('bounce');
    // 强制重排触发动画
    void coinsEl.offsetWidth;
    coinsEl.classList.add('bounce');
  }
};

// ===== 注册 Service Worker =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration.scope);
    })
    .catch((error) => {
      console.log('Service Worker registration failed:', error);
      // 本地文件打开时 SW 不可用，不影响功能
    });
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  
  // 监听数据变化事件
  window.bus.on('data:changed', (key) => {
    if (key && (key.includes('coins') || key.includes('user'))) {
      window.updateCoinDisplay();
    }
  });
});
