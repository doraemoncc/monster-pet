// Service Worker - 离线缓存
const CACHE_NAME = 'monster-pet-v2';

// 需要缓存的静态资源
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/components.css',
  './css/pet.css',
  './css/task.css',
  './css/shop.css',
  './css/parent.css',
  './js/app.js',
  './js/store.js',
  './js/onboarding.js',
  './js/pet-renderer.js',
  './js/pet-interaction.js',
  './js/task-list.js',
  './js/task-parser.js',
  './js/task-ai.js',
  './js/task-creator.js',
  './js/task-templates.js',
  './js/weekly-plan.js',
  './js/reminder.js',
  './js/shop.js',
  './js/parent-panel.js'
];

// 安装：预缓存所有静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 拦截请求：网络优先策略（保证始终加载最新代码，离线时降级到缓存）
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).then((response) => {
      // 网络请求成功，更新缓存
      if (event.request.method === 'GET' && response.status === 200) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(() => {
      // 网络失败时从缓存读取（离线模式）
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        // 文档请求降级到首页
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
