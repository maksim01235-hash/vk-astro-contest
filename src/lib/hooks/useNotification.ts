/**
 * src/lib/hooks/useNotification.ts — запрос разрешения на уведомления.
 *
 * Обновления (август 2026, сервер-как-источник-истины):
 *  - Решение «показывать ли попап» принимается по флагу subscribed из листа
 *    Users (userStore.userRecord), а не по локальным ключам first_visit /
 *    notif_requested (удалены).
 *  - Факт закрытия попапа («Не сейчас») и сбой запроса запоминаются локально
 *    только как UI-предпочтение (STORAGE_NOTIF_DISMISSED), чтобы не донимать
 *    пользователя.
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
import { STORAGE_NOTIF_DISMISSED } from '@/constants';
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

  /** Попап показываем, пока пользователь не подписан и не закрыл его раньше. */
  const checkShouldShow = useCallback(() => {
    if (!vkUser) return;

    if (getRaw<boolean>(STORAGE_NOTIF_DISMISSED)) return;
    if (userRecord?.subscribed) return;

    setShowPopup(true);
  }, [vkUser, userRecord]);

  /** Показать попап после отправки ответа (страница /thanks). */
  const showAfterSubmit = useCallback(() => {
    if (!vkUser) return;

    if (getRaw<boolean>(STORAGE_NOTIF_DISMISSED)) return;
    if (userRecord?.subscribed) return;

    setShowPopup(true);
  }, [vkUser, userRecord]);

  const request = useCallback(async () => {
    if (!vkUser || requesting) return false;

    setRequesting(true);
    await logEvent('notification_request', { vk_id: vkUser.id });

    try {
      // При client_error requestNotifications бросит raw ошибку VK Bridge.
      await requestNotifications();

      const timestamp = nowISO();
      const updatedUser: UserRecord = {
        vk_id: vkUser.id,
        name: userRecord?.name || vkUser.name || `${vkUser.first_name} ${vkUser.last_name}`.trim(),
        reg_date: userRecord?.reg_date || timestamp,
        subscribed: true,
        last_activity: timestamp,
      };

      // Подписка — данные пользователя: живёт в таблице (лист Users).
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

      // Сбой запроса: больше не показываем попап в этой сессии/на этом устройстве.
      setRaw(STORAGE_NOTIF_DISMISSED, true);
      setShowPopup(false);
      return false;
    } finally {
      setRequesting(false);
    }
  }, [requesting, setUserRecord, userRecord, vkUser]);

  const dismiss = useCallback(() => {
    // UI-предпочтение: пользователь уже видел попап и отказался.
    setRaw(STORAGE_NOTIF_DISMISSED, true);
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
