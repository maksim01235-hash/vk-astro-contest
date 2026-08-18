/**
 * lib/hooks/useAuth.ts — хук авторизации пользователя.
 *
 * Исправления (август 2026):
 *  - Защита от параллельных/повторных autoAuth, чтобы checkUser не уходил 2–3 раза.
 *  - initBridge и hydrate выполняются в Providers.tsx, а не здесь.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useUserStore } from '@/lib/store/userStore';
import { getUserInfo } from '@/lib/vk/bridge';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';

export function useAuth() {
  const {
    vkUser,
    userRecord,
    isAuthed,
    loading,
    setVkUser,
    setUserRecord,
    setLoading,
  } = useUserStore();
  const [error, setError] = useState<string | null>(null);

  /**
   * Защита от одновременных повторных запусков авторизации.
   * Нужна в том числе из-за React Strict Mode в режиме разработки.
   */
  const authInProgressRef = useRef(false);

  /**
   * Получить пользователя из VK Bridge и проверить/создать его в Sheets.
   * Один вызов login = максимум один запрос checkUser.
   */
  const autoAuth = useCallback(async () => {
    // Не запускаем ещё одну цепочку, пока текущая не завершилась.
    if (authInProgressRef.current) return;

    // Если пользователь и запись из Sheets уже есть, повторный запрос не нужен.
    const state = useUserStore.getState();
    if (state.vkUser && state.userRecord) return;

    authInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const user = await getUserInfo();
      if (!user) return;

      // Записываем пользователя сразу: дальнейшие попытки уже увидят vkUser.
      setVkUser(user);
      await logEvent('auth_success', { vk_id: user.id });

      // Запрашиваем запись пользователя в Sheets ровно один раз.
      const record = await sheetsApi.checkUser(
        user.id,
        user.name || `${user.first_name} ${user.last_name}`.trim(),
      );
      setUserRecord(record);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка авторизации';
      setError(msg);
      await logEvent('auth_fail', { error: msg });
    } finally {
      authInProgressRef.current = false;
      setLoading(false);
    }
  }, [setVkUser, setUserRecord, setLoading]);

  /** Ручная авторизация по кнопке. */
  const login = useCallback(async () => {
    await autoAuth();
  }, [autoAuth]);

  return { vkUser, userRecord, isAuthed, loading, error, login };
}