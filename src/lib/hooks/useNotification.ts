/**
 * lib/hooks/useNotification.ts — хук для запроса уведомлений.
 *
 * Логика:
 *  - При первом заходе и после отправки ответа — показываем попап.
 *  - Запрос VKWebAppAllowNotifications.
 *  - Сохраняем subscribed=true в Users (через sheetsApi.saveUser).
 *  - Флаг "запрошено" кешируется в localStorage (чтобы не просить повторно).
 */

'use client';

import { useState, useCallback } from 'react';
import { requestNotifications } from '@/lib/vk/bridge';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { useUserStore } from '@/lib/store/userStore';
import { STORAGE_NOTIF_REQUESTED, STORAGE_FIRST_VISIT } from '@/constants';
import { getRaw, setRaw } from '@/utils/storage';
import { nowISO } from '@/utils/time';

export function useNotification() {
  const { vkUser, userRecord, setUserRecord } = useUserStore();
  const [showPopup, setShowPopup] = useState(false);
  const [requesting, setRequesting] = useState(false);

  /** Проверить, нужно ли показать попап (первый заход или после ответа). */
  const checkShouldShow = useCallback(() => {
    const firstVisit = getRaw<boolean>(STORAGE_FIRST_VISIT);
    if (!firstVisit) {
      setRaw(STORAGE_FIRST_VISIT, true);
      setShowPopup(true);
      return;
    }
    // После отправки ответа — вызываем showAfterSubmit() явно.
  }, []);

  /** Показать попап после отправки ответа. */
  const showAfterSubmit = useCallback(() => {
    const requested = getRaw<boolean>(STORAGE_NOTIF_REQUESTED);
    if (!requested) {
      setShowPopup(true);
    }
  }, []);

  /** Запросить разрешение на уведомления. */
  const request = useCallback(async () => {
    setRequesting(true);
    await logEvent('notification_request', { vk_id: vkUser?.id });
    try {
      const ok = await requestNotifications();
      setRaw(STORAGE_NOTIF_REQUESTED, true);
      if (ok) {
        await logEvent('notification_granted', { vk_id: vkUser?.id });
        // Сохраняем subscribed=true в Users.
        if (userRecord) {
          const updated = { ...userRecord, subscribed: true, last_activity: nowISO() };
          await sheetsApi.saveUser(updated);
          setUserRecord(updated);
        }
      } else {
        await logEvent('notification_denied', { vk_id: vkUser?.id });
      }
      setShowPopup(false);
      return ok;
    } catch (e) {
      await logEvent('notification_denied', {
        vk_id: vkUser?.id,
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    } finally {
      setRequesting(false);
    }
  }, [vkUser, userRecord, setUserRecord]);

  /** Отклонить попап (пользователь нажал "Не сейчас"). */
  const dismiss = useCallback(() => {
    setRaw(STORAGE_NOTIF_REQUESTED, true);
    setShowPopup(false);
  }, []);

  return {
    showPopup,
    requesting,
    checkShouldShow,
    showAfterSubmit,
    request,
    dismiss,
  };
}
