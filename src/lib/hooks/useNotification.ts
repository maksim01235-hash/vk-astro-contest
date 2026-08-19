/**
 * src/lib/hooks/useNotification.ts — запрос разрешения на уведомления.
 *
 * Особенности:
 *  - Попап показывается только после готовности vkUser (контролирует Providers).
 *  - request дополнительно защищён от вызова без vkUser.
 *  - При успешном разрешении subscribed=true всегда записывается в Sheets,
 *    включая первый визит, когда userRecord ещё может быть null.
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
    // Дополнительная защита: Providers тоже не вызывает функцию до авторизации.
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

  /** Показать попап после отправки ответа, пока пользователь не сделал выбор. */
  const showAfterSubmit = useCallback(() => {
    if (!vkUser) return;

    const requested = getRaw<boolean>(STORAGE_NOTIF_REQUESTED);
    if (!requested) {
      setShowPopup(true);
    }
  }, [vkUser]);

  /**
   * Запросить разрешение от VK и сохранить subscribed=true.
   *
   * Запрос намеренно не выполняется, пока отсутствует vkUser: без реального
   * VK ID вызов Bridge происходил как anonymous и возвращал client_error.
   */
  const request = useCallback(async () => {
    if (!vkUser || requesting) {
      return false;
    }

    setRequesting(true);
    await logEvent('notification_request', { vk_id: vkUser.id });

    try {
      const allowed = await requestNotifications();
      setRaw(STORAGE_NOTIF_REQUESTED, true);

      if (!allowed) {
        await logEvent('notification_denied', { vk_id: vkUser.id });
        setShowPopup(false);
        return false;
      }

      const timestamp = nowISO();
      const updatedUser: UserRecord = {
        vk_id: vkUser.id,
        name: userRecord?.name || vkUser.name || `${vkUser.first_name} ${vkUser.last_name}`.trim(),
        reg_date: userRecord?.reg_date || timestamp,
        subscribed: true,
        last_activity: timestamp,
      };

      // Даже когда userRecord был null на первом визите, обновляем/создаём строку.
      await sheetsApi.saveUser(updatedUser);
      setUserRecord(updatedUser);
      await logEvent('notification_granted', { vk_id: vkUser.id });

      setShowPopup(false);
      return true;
    } catch (error) {
      await logEvent('notification_denied', {
        vk_id: vkUser.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      setRequesting(false);
    }
  }, [requesting, setUserRecord, userRecord, vkUser]);

  /** Пользователь закрыл попап без выдачи разрешения. */
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