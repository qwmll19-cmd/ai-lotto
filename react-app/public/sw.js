/**
 * AI Lotto Service Worker
 * 푸시 알림 수신 및 처리
 */

const CACHE_NAME = 'ai-lotto-v1';

// 서비스 워커 설치
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker 설치됨');
  self.skipWaiting();
});

// 서비스 워커 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker 활성화됨');
  event.waitUntil(clients.claim());
});

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('[SW] 푸시 알림 수신:', event);

  let data = {
    title: 'AI 로또',
    body: '새로운 알림이 있습니다.',
    icon: '/assets/icon-192.png',
    badge: '/assets/badge-72.png',
    data: { url: '/' }
  };

  // 푸시 데이터 파싱
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || data.data
      };
    } catch (e) {
      console.error('[SW] 푸시 데이터 파싱 오류:', e);
      data.body = event.data.text();
    }
  }

  // 알림 표시
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    vibrate: [100, 50, 100],
    requireInteraction: true,
    actions: [
      { action: 'open', title: '확인하기' },
      { action: 'close', title: '닫기' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 알림 클릭:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // 알림 데이터에서 URL 추출
  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열려있는 창이 있으면 포커스
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// 알림 닫기 처리
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] 알림 닫힘');
});

// 푸시 구독 변경 처리
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] 푸시 구독 변경됨');

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.vapidPublicKey
    })
    .then((subscription) => {
      // 서버에 새 구독 정보 전송
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
        credentials: 'include'
      });
    })
    .catch((error) => {
      console.error('[SW] 재구독 실패:', error);
    })
  );
});
