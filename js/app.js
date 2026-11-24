/**
 * 主应用入口：路由、事件总线、Service Worker 注册
 */

// ===== 统一本地日期工具（全项目唯一事实来源）=====
// ⚠️ 时间戳用 UTC ISO（toISOString()）是正确的；但「某一天」的键必须按本地日历日。
//    GMT+8 本地 00:00-08:00 时 UTC 仍是前一天，用 slice(0,10) 会让跨天重置、
//    任务生成、门卫解锁、连击、统计归档整体错位一天。
//    本文件是 index.html 的第一个脚本；store.js 末尾 new Store().init() 会立即用到这些函数。
//    禁止在其他文件重新实现 getDateStr / localDateStr / dateKey —— 一律委托这里。
function localDateKey(d) {
  // 纯 'YYYY-MM-DD' 原样返回：避免 new Date('2026-11-24') 按 UTC 午夜解析，在负时区退一天
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const x = d ? new Date(d) : new Date();
  if (isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// UTC ISO 时间戳 → 本地日期键（completedAt / createdAt 专用），非法日期返回 ''
function localDateKeyOfISO(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return localDateKey(d);
}

function isLocalTodayISO(iso) {
  return localDateKeyOfISO(iso) === localDateKey();
}

// 本周一 / 本周日的本地日期键（用本地年月日构造，规避 UTC 偏移与 DST）
function localWeekKey(d) {
  let x;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const p = d.split('-').map(Number);
    x = new Date(p[0], p[1] - 1, p[2]);
  } else {
    x = d ? new Date(d) : new Date();
  }
  if (isNaN(x.getTime())) return '';
  const diff = x.getDay() === 0 ? -6 : 1 - x.getDay();
  return localDateKey(new Date(x.getFullYear(), x.getMonth(), x.getDate() + diff));
}

function localWeekSundayKey(d) {
  const mon = localWeekKey(d);
  if (!mon) return '';
  const p = mon.split('-').map(Number);
  return localDateKey(new Date(p[0], p[1] - 1, p[2] + 6));
}

// 仅用于识别旧版 UTC 口径数据，业务代码禁止调用
function utcDateKey(d) {
  const x = d ? new Date(d) : new Date();
  return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10);
}

Object.assign(window, {
  localDateKey, localDateKeyOfISO, isLocalTodayISO,
  localWeekKey, localWeekSundayKey, utcDateKey
});

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
  // 切换页面前先清理残留的门卫/引导遮罩，避免它继续遮挡其他页面交互
  // （门卫仅用于拦截进入 shop/pet；用户一旦切到别的页面，遮罩就应消失）
  document.querySelectorAll('.guard-overlay:not(.unlock-celebration)').forEach(o => o.remove());

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

  // 计算今日进度（本地日期键；createdAt 是 UTC ISO，必须转成当地日历日）
  const todayKey = localDateKey();
  const allTasks = (window.store.get('tasks') || []).filter(t =>
    t.lastResetDate === todayKey ||
    (t.createdAt && localDateKeyOfISO(t.createdAt) === todayKey)
  );
  const doneTasks = allTasks.filter(t => t.status === 'completed').length;
  const totalTasks = allTasks.length;
  const progressHtml = totalTasks > 0
    ? `<div class="guard-progress">
         <span>今日进度：${doneTasks} / ${totalTasks} 个任务</span>
         <div class="guard-progress-bar">
           <div class="guard-progress-fill" style="width:${Math.round(doneTasks / totalTasks * 100)}%"></div>
         </div>
       </div>`
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'guard-overlay';
  overlay.innerHTML = `
    <div class="guard-card">
      <div class="guard-icon">${icon}</div>
      <div class="guard-title">等一下~</div>
      <div class="guard-message">${msg}</div>
      ${progressHtml}
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

// ===== 更新导航栏解锁状态 =====
function updateNavUnlockState() {
  const shopUnlocked = window.store && window.store.isDailyUnlocked('shop');
  const petUnlocked  = window.store && window.store.isDailyUnlocked('pet');

  const shopNav = document.querySelector('.nav-item[data-page="shop"]');
  const petNav  = document.querySelector('.nav-item[data-page="pet"]');

  if (shopNav) {
    shopNav.classList.toggle('nav-locked', !shopUnlocked);
    shopNav.classList.toggle('nav-unlocked', !!shopUnlocked);
  }
  if (petNav) {
    petNav.classList.toggle('nav-locked', !petUnlocked);
    petNav.classList.toggle('nav-unlocked', !!petUnlocked);
  }
}
window.updateNavUnlockState = updateNavUnlockState;

// ===== 庆祝弹窗（完成所有任务时）=====
function showUnlockCelebration() {
  // 防止重复弹出
  if (document.querySelector('.unlock-celebration')) return;

  const overlay = document.createElement('div');
  overlay.className = 'guard-overlay unlock-celebration';
  overlay.innerHTML = `
    <div class="guard-card celebration-card">
      <div class="celebration-confetti">🎉🎊🎉</div>
      <div class="guard-title">太棒了！</div>
      <div class="guard-message">今天的任务全部完成！<br>宠物乐园和星币商城都解锁啦~</div>
      <div class="guard-actions celebration-actions">
        <button class="btn btn-guard-go" id="cel-go-pet">去宠物乐园 🐾</button>
        <button class="btn-guard-secondary" id="cel-go-shop">逛商城 🏪</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('cel-go-pet').addEventListener('click', () => {
    overlay.remove();
    window.location.hash = 'pet';
  });
  document.getElementById('cel-go-shop').addEventListener('click', () => {
    overlay.remove();
    window.location.hash = 'shop';
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
window.showUnlockCelebration = showUnlockCelebration;

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

// ===== Service Worker：仅线上注册，本地预览强制禁用并清理 =====
// 根因：本地改完代码后，SW 仍用旧缓存拦截请求，导致刷新也看不到最新版。
// 解决：本地环境（localhost / file://）不仅不注册 SW，还主动注销已注册的 SW 并清空 caches，
// 保证每次加载都是磁盘上的最新文件。线上 GitHub Pages 继续用 SW 做离线缓存。
(function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const isLocal = location.protocol === 'file:' ||
    ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname);

  if (isLocal) {
    // 注销所有已注册的 SW，并清空 Cache Storage，避免旧缓存污染
    const clearCaches = () => {
      if (window.caches) {
        return caches.keys()
          .then(keys => Promise.all(keys.map(key => caches.delete(key))))
          .catch(() => {});
      }
      return Promise.resolve();
    };

    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(reg => reg.unregister())))
      .catch(() => {})
      .then(clearCaches)
      .then(() => {
        // 若当前页仍被旧 SW 控制，重载一次让它彻底失效（用标记防止无限刷新）
        if (hadController && !sessionStorage.getItem('__sw_clean_reloaded')) {
          sessionStorage.setItem('__sw_clean_reloaded', '1');
          location.reload();
        }
      });
    console.log('[dev] Service Worker disabled & caches cleared (local preview)');
    return;
  }

  navigator.serviceWorker.register('./sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration.scope);
    })
    .catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
})();

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  // 初始化导航栏解锁状态
  updateNavUnlockState();

  // 监听数据变化事件
  window.bus.on('data:changed', (key) => {
    if (key && (key.includes('coins') || key.includes('user'))) {
      window.updateCoinDisplay();
    }
  });
});
