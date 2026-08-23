/**
 * lib/hooks/useAuth.ts — хук авторизации пользователя.
 *
 * Обновления (август 2026):
 *  - Общая цепочка checkUser → getAnsweredCards вынесена в fetchAndApplyUserData:
 *    её использует и кнопка входа, и тихий bootstrap при запуске приложения.
 *  - bootstrap(): для возвращающихся пользователей (vkUser восстановлен из
 *    localStorage, а userRecord отсутствует) молча синхронизируется с таблицей —
 *    обновляет строку в листе Users и подтягивает список отвеченных карточек.
 *    Без этого возвращающиеся пользователи вообще не попадали в Users,
 *    а статусы «Выполнено» жили только на локальных флагах.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useUserStore } from '@/lib/store/userStore';
import { getUserInfo } from '@/lib/vk/bridge';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import type { VKUserInfo } from '@/types';

export function useAuth() {
  const {
    vkUser,
    userRecord,
    isAuthed,
    loading,
    setVkUser,
    setLoading,
  } = useUserStore();
  const [error, setError] = useState<string | null>(null);

  /**
   * Защита от одновременных повторных autoAuth/bootstrap, чтобы checkUser
   * не уходил 2–3 раза. Нужна в том числе из-за React Strict Mode в разработке.
   */
  const authInProgressRef = useRef(false);
  const bootstrapInProgressRef = useRef(false);

  /**
   * Проверить/создать пользователя в Sheets и подгрузить список отвеченных
   * карточек. Единая точка правды для кнопки входа и тихого bootstrap'а.
   */
  const fetchAndApplyUserData = useCallback(async (user: VKUserInfo) => {
    // Запрашиваем запись пользователя в Sheets ровно один раз за цепочку.
    const record = await sheetsApi.checkUser(
      user.id,
      user.name || `${user.first_name} ${user.last_name}`.trim(),
    );
    useUserStore.getState().setUserRecord(record);

    // Подгружаем, на какие карточки пользователь уже ответил
    // (для статусов «Выполнено» и защиты от повторной отправки).
    try {
      const answered = await sheetsApi.getAnsweredCards(user.id);
      useUserStore.getState().setAnsweredCardIds(answered);
    } catch {
      // Список отвеченных некритичен: статусы останутся пустыми до следующего запуска.
    }
  }, []);

  /**
   * Тихая синхронизация восстановленного пользователя с таблицей.
   * Вызывается из Providers после hydrate; не показывает ошибок пользователю.
   */
  const bootstrap = useCallback(async () => {
    if (bootstrapInProgressRef.current) return;

    const state = useUserStore.getState();
    // Нечего синхронизировать: нет VK-пользователя или запись уже загружена.
    if (!state.vkUser || state.userRecord) return;

    bootstrapInProgressRef.current = true;
    setLoading(true);

    try {
      await fetchAndApplyUserData(state.vkUser);
    } catch (e) {
      console.warn('[useAuth] bootstrap failed:', e);
      await logEvent('api_error', {
        action: 'bootstrap',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      bootstrapInProgressRef.current = false;
      setLoading(false);
    }
  }, [fetchAndApplyUserData, setLoading]);

  /**
   * Полная авторизация: получить пользователя из VK Bridge и синхронизировать
   * с таблицей. Один вызов login = максимум один запрос checkUser.
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

      await fetchAndApplyUserData(user);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка авторизации';
      setError(msg);
      await logEvent('auth_fail', { error: msg });
    } finally {
      authInProgressRef.current = false;
      setLoading(false);
    }
  }, [fetchAndApplyUserData, setVkUser, setLoading]);

  /** Ручная авторизация по кнопке. */
  const login = useCallback(async () => {
    await autoAuth();
  }, [autoAuth]);

  return { vkUser, userRecord, isAuthed, loading, error, login, bootstrap };
}
