/**
 * src/lib/hooks/useNotification.ts — запрос разрешения на уведомления.
 *
 * При успешном разрешении subscribed=true всегда отправляется в Sheets,
 * даже если userRecord ещё не успел появиться в Zustand на первом визите.
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

export function useNotification() {
  const { vkUser, userRecord, setUserRecord } = useUserStore();
  const [showPopup, setShowPopup] = useState(false);
  const [requesting, setRequesting] = useState(false);

  /** Показать попап на первом визите, если пользователь ещё не сделал выбор. */
  const checkShouldShow = useCallback(() => {
    const firstVisit = getRaw<boolean>(STORAGE_FIRST_VISIT);
    const requested = getRaw<boolean>(STORAGE_NOTIF_REQUESTED);

    if (!firstVisit) {
      setRaw(STORAGE_FIRST_VISIT, true);
    }

    if (!requested) {
      setShowPopup(true);
    }
  }, []);

  /** Показать попап после отправки ответа, пока пользователь не сделал выбор. */
  const showAfterSubmit = useCallback(() => {
    const requested = getRaw<boolean>(STORAGE_NOTIF_REQUESTED);
    if (!requested) {
      setShowPopup(true);
    }
  }, []);

  /**
   * Запросить разрешение и сохранить subscribed=true.
   *
   * Важно: на первом визите userRecord может быть null из-за асинхронного
   * checkUser. Тогда собираем запись из vkUser, а saveUser на сервере
   * обновит существующую строку по vk_id или создаст её при необходимости.
   */
  const request = useCallback(async () => {
    setRequesting(true);
    await logEvent('notification_request', { vk_id: vkUser?.id });

    try {
      const allowed = await requestNotifications();
      setRaw(STORAGE_NOTIF_REQUESTED, true);

      if (allowed && vkUser) {
        const timestamp = nowISO();
        const updatedUser: UserRecord = {
          vk_id: vkUser.id,
          name: userRecord?.name || vkUser.name || `${vkUser.first_name} ${vkUser.last_name}`.trim(),
          reg_date: userRecord?.reg_date || timestamp,
          subscribed: true,
          last_activity: timestamp,
        };

        // Всегда вызывается при разрешении — независимо от наличия userRecord.
        await sheetsApi.saveUser(updatedUser);
        setUserRecord(updatedUser);
        await logEvent('notification_granted', { vk_id: vkUser.id });
      } else if (allowed) {
        // Разрешение получено, но VK-пользователь временно недоступен.
        await logEvent('notification_granted', {
          vk_id: 'anonymous',
          warning: 'vkUser is unavailable; subscribed was not saved to Users',
        });
      } else {
        await logEvent('notification_denied', { vk_id: vkUser?.id });
      }

      setShowPopup(false);
      return allowed;
    } catch (error) {
      await logEvent('notification_denied', {
        vk_id: vkUser?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      setRequesting(false);
    }
  }, [setUserRecord, userRecord, vkUser]);

  /** Пользователь закрыл попап без запроса разрешения. */
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