/**
 * 웹 푸시 알림 관리 훅
 */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchVapidPublicKey,
  subscribePush,
  unsubscribePush,
  fetchNotificationSettings,
  updateNotificationSettings
} from '../api/lottoApi';

// VAPID 공개키를 Uint8Array로 변환
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotification() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState('default');
  const [settings, setSettings] = useState({
    notify_draw_result: true,
    notify_recommendation: true,
    notify_subscription_expiry: true
  });
  const [error, setError] = useState(null);

  // 지원 여부 확인 및 초기 상태 로드
  useEffect(() => {
    const init = async () => {
      // 브라우저 지원 여부 확인
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);

      if (!supported) {
        setIsLoading(false);
        return;
      }

      // 알림 권한 상태
      setPermission(Notification.permission);

      try {
        // 서버에서 알림 설정 가져오기
        const serverSettings = await fetchNotificationSettings();
        if (serverSettings) {
          setSettings(serverSettings);
          setIsSubscribed(true);
        }
      } catch (err) {
        // 구독 정보가 없는 경우 (정상)
        if (err.response?.status !== 404) {
          console.error('알림 설정 로드 실패:', err);
        }
      }

      // 서비스 워커 등록 확인
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          setIsSubscribed(true);
        }
      } catch (err) {
        console.error('구독 상태 확인 실패:', err);
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // 서비스 워커 등록
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('서비스 워커가 지원되지 않습니다.');
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('서비스 워커 등록 성공:', registration);
      return registration;
    } catch (err) {
      console.error('서비스 워커 등록 실패:', err);
      throw err;
    }
  }, []);

  // 푸시 알림 구독
  const subscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // 알림 권한 요청
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        throw new Error('알림 권한이 거부되었습니다.');
      }

      // 서비스 워커 등록
      const registration = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      // VAPID 공개키 가져오기
      const vapidResponse = await fetchVapidPublicKey();
      const vapidPublicKey = vapidResponse.public_key || vapidResponse.vapid_public_key;
      if (!vapidPublicKey) {
        throw new Error('VAPID 키를 가져올 수 없습니다.');
      }

      // 기존 구독 확인
      let subscription = await registration.pushManager.getSubscription();

      // 새 구독 생성
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // 서버에 구독 정보 전송
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
        }
      };

      await subscribePush(subscriptionData);

      setIsSubscribed(true);
      console.log('푸시 알림 구독 완료');

      return true;
    } catch (err) {
      console.error('푸시 알림 구독 실패:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registerServiceWorker]);

  // 푸시 알림 구독 해제
  const unsubscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // 브라우저 구독 해제
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      // 서버에 구독 해제 요청
      await unsubscribePush();

      setIsSubscribed(false);
      console.log('푸시 알림 구독 해제 완료');

      return true;
    } catch (err) {
      console.error('푸시 알림 구독 해제 실패:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 알림 설정 업데이트
  const updateSettings = useCallback(async (newSettings) => {
    setError(null);

    try {
      const updated = await updateNotificationSettings(newSettings);
      setSettings(updated);
      return true;
    } catch (err) {
      console.error('알림 설정 업데이트 실패:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // 개별 설정 토글
  const toggleSetting = useCallback(async (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    return updateSettings(newSettings);
  }, [settings, updateSettings]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    settings,
    error,
    subscribe,
    unsubscribe,
    updateSettings,
    toggleSetting
  };
}

export default usePushNotification;
