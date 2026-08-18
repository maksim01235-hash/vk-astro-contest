/**
 * components/common/Providers.tsx — клиентский провайдер.
 *
 * Инициализирует VK Bridge и Zustand hydrate ровно один раз,
 * показывает Toast/NotificationModal, синхронизирует офлайн-очередь.
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
  const hydrate = useUserStore((s) => s.hydrate);
  const { checkShouldShow, showPopup, request, dismiss, requesting } =
    useNotification();
  const [mounted, setMounted] = useState(false);

  /**
   * Единственная точка начальной инициализации приложения.
   * useAuth не дублирует initBridge/hydrate.
   */
  useEffect(() => {
    initBridge();
    hydrate();
    checkShouldShow();
    setMounted(true);
  }, [hydrate, checkShouldShow]);

  /** Отправить офлайн-очередь после восстановления сети. */
  useEffect(() => {
    if (!mounted) return;

    const handleOnline = async () => {
      const queue = getRaw<AnswerRecord[]>(STORAGE_OFFLINE_QUEUE);
      if (!queue || queue.length === 0) return;

      try {
        await sheetsApi.syncOffline(queue);
        setRaw(STORAGE_OFFLINE_QUEUE, []);
        await logEvent('offline_sync', { count: queue.length });
      } catch (e) {
        console.warn('[providers] offline sync failed:', e);
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