/**
 * src/components/common/Providers.tsx — глобальный клиентский провайдер.
 *
 * Важно: попап разрешения уведомлений показывается только после появления
 * vkUser. Иначе VKWebAppAllowNotifications вызывается слишком рано и VK
 * возвращает client_error.
 */

'use client';

import { useEffect, ReactNode, useState } from 'react';
import { initBridge } from '@/lib/vk/bridge';
import { useUserStore } from '@/lib/store/userStore';
import { ToastContainer } from '@/components/ui/Toast';
import { useNotification } from '@/lib/hooks/useNotification';
import { NotificationModal } from '@/components/quiz/NotificationModal';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { STORAGE_OFFLINE_QUEUE } from '@/constants';
import { getRaw, setRaw } from '@/utils/storage';
import type { AnswerRecord } from '@/types';

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useUserStore((state) => state.hydrate);
  const vkUser = useUserStore((state) => state.vkUser);
  const {
    checkShouldShow,
    showPopup,
    request,
    dismiss,
    requesting,
  } = useNotification();
  const [mounted, setMounted] = useState(false);

  /** Инициализация VK Bridge и восстановление локального пользователя. */
  useEffect(() => {
    initBridge();
    hydrate();
    setMounted(true);
  }, [hydrate]);

  /**
   * Попап уведомлений разрешено показывать только после авторизации.
   * Когда vkUser отсутствует, вызов VKWebAppAllowNotifications может завершиться
   * client_error: Bridge ещё не готов работать от имени конкретного пользователя.
   */
  useEffect(() => {
    if (!mounted || !vkUser) return;
    checkShouldShow();
  }, [mounted, vkUser, checkShouldShow]);

  /** Отправить сохранённую офлайн-очередь после восстановления сети. */
  useEffect(() => {
    if (!mounted) return;

    const handleOnline = async () => {
      const queue = getRaw<AnswerRecord[]>(STORAGE_OFFLINE_QUEUE);
      if (!queue || queue.length === 0) return;

      try {
        const { saved, skipped } = await sheetsApi.syncOffline(queue);
        // Очищаем очередь только когда сервер обработал всё (сохранено +
        // отброшено как дубликаты). Необработанные ответы остаются для
        // повторного синка — дедупликация на сервере делает его безопасным.
        if (saved + skipped >= queue.length) {
          setRaw(STORAGE_OFFLINE_QUEUE, []);
        }
        await logEvent('offline_sync', { count: queue.length, saved, skipped });
      } catch (error) {
        console.warn('[providers] offline sync failed:', error);
      }
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      void handleOnline();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [mounted]);

  return (
    <>
      {children}
      <ToastContainer />
      <NotificationModal
        open={showPopup}
        onAllow={request}
        onDismiss={dismiss}
        requesting={requesting}
      />
    </>
  );
}