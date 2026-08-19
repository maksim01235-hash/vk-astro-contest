/**
 * src/lib/hooks/useNotification.ts — запрос разрешения на уведомления.
 *
 * Диагностика: подробности ошибки VK Bridge (error_type, error_data, message)
 * сохраняются в накопленный лог при неудачном VKWebAppAllowNotifications.
 */

'use client';

import { useCallback, useState } from 'react';
import { requestNotifications } from '@/lib/vk/bridge';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { useUserStore } from '@/lib/store/userStore';
import { STORAGE_FIRST_VISIT, STORAGE_NOTIF_REQUESTED } from '@/constants';
import { getRaw, setRaw } from '@/utils/storage';
import { nowISO } from '@/utils/time';
import type { UserRecord } from '@/types';

/** Безопасно извлечь полезные поля из неизвестной ошибки VK Bridge. */
function serializeBridgeError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') {
    return { raw: String(error) };
  }

  const bridgeError = error as {
    message?: unknown;
    error_type?: unknown;
    error_data?: unknown;
    code?: unknown;
    detail?: unknown;
  };

  return {
    message: typeof bridgeError.message === 'string' ? bridgeError.message : String(error),
    error_type: bridgeError.error_type ?? null,
    error_data: bridgeError.error_data ?? null,
    code: bridgeError.code ?? null,
    detail: bridgeError.detail ?? null,
  };
}

export function useNotification() {
  const { vkUser, userRecord, setUserRecord } = useUserStore();
  const [showPopup, setShowPopup] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const checkShouldShow = useCallback(() => {
    if (!vkUser) return;

    const firstVisit = getRaw<boolean>(STORAGE_FIRST_VISIT);
    const requested = getRaw<boolean>(STORAGE_NOTIF_REQUESTED);

    if (!firstVisit) {
      setRaw(STORAGE_FIRST_VISIT, true);
    }

    if (!requested) {
      setShowPopup(true);
    }
  }, [vkUser]);

  const showAfterSubmit = useCallback(() => {
    if (!vkUser) return;

    const requested = getRaw<boolean>(STORAGE_NOTIF_REQUESTED);
    if (!requested) {
      setShowPopup(true);
    }
  }, [vkUser]);

  const request = useCallback(async () => {
    if (!vkUser || requesting) return false;

    setRequesting(true);
    await logEvent('notification_request', { vk_id: vkUser.id });

    try {
      // При client_error requestNotifications бросит raw ошибку VK Bridge.
      await requestNotifications();
      setRaw(STORAGE_NOTIF_REQUESTED, true);

      const timestamp = nowISO();
      const updatedUser: UserRecord = {
        vk_id: vkUser.id,
        name: userRecord?.name || vkUser.name || `${vkUser.first_name} ${vkUser.last_name}`.trim(),
        reg_date: userRecord?.reg_date || timestamp,
        subscribed: true,
        last_activity: timestamp,
      };

      await sheetsApi.saveUser(updatedUser);
      setUserRecord(updatedUser);
      await logEvent('notification_granted', { vk_id: vkUser.id });

      setShowPopup(false);
      return true;
    } catch (error) {
      // ВАЖНО: сохраняем все поля VK ошибки, а не только строку message.
      await logEvent('notification_denied', {
        vk_id: vkUser.id,
        bridge_error: serializeBridgeError(error),
      });

      // Пользователь уже сделал выбор/получил ошибку VK — повторно не показываем
      // тот же попап до очистки localStorage.
      setRaw(STORAGE_NOTIF_REQUESTED, true);
      setShowPopup(false);
      return false;
    } finally {
      setRequesting(false);
    }
  }, [requesting, setUserRecord, userRecord, vkUser]);

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