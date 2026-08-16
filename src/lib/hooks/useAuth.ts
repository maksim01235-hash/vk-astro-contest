/**
 * lib/hooks/useAuth.ts — хук авторизации пользователя.
 *
 * Логика:
 *  1. При монтировании пытаемся получить VK-пользователя (VK Bridge).
 *  2. Если есть — проверяем в Google Sheets (checkUser). Если новый — автосоздание.
 *  3. Если данных нет — показываем кнопку "Авторизоваться через VK".
 *  4. Сохраняем в Zustand store + localStorage.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '@/lib/store/userStore';
import { getUserInfo, initBridge } from '@/lib/vk/bridge';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { MOCK_MODE } from '@/constants';
import type { VKUserInfo, UserRecord } from '@/types';

export function useAuth() {
  const {
    vkUser,
    userRecord,
    isAuthed,
    loading,
    setVkUser,
    setUserRecord,
    setLoading,
    hydrate,
  } = useUserStore();
  const [error, setError] = useState<string | null>(null);

  /** Инициализация при монтировании. */
  useEffect(() => {
    hydrate();
    initBridge();
    // В mock-режиме сразу отдаём тестового пользователя.
    if (MOCK_MODE && !isAuthed) {
      autoAuth();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Автоматическая авторизация (пытаемся получить VK-пользователя тихо). */
  const autoAuth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await getUserInfo();
      if (!user) {
        setLoading(false);
        return;
      }
      setVkUser(user);
      await logEvent('auth_success', { vk_id: user.id });
      // Проверяем/создаём в Sheets, передаём имя из VK для сохранения.
      const record = await sheetsApi.checkUser(user.id, user.name || `${user.first_name} ${user.last_name}`.trim());
      setUserRecord(record);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка авторизации';
      setError(msg);
      await logEvent('auth_fail', { error: msg });
    } finally {
      setLoading(false);
    }
  }, [setVkUser, setUserRecord, setLoading]);

  /** Ручная авторизация (по кнопке). */
  const login = useCallback(async () => {
    await autoAuth();
  }, [autoAuth]);

  return { vkUser, userRecord, isAuthed, loading, error, login };
}
