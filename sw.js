self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Оставляем пустым для обычной загрузки из сети без кэширования
});