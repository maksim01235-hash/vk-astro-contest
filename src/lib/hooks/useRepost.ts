/**
 * lib/hooks/useRepost.ts — хук проверки и выполнения репоста.
 *
 * Обновления (август 2026, сервер-как-источник-истины):
 *  - Локальный кеш «репост сделан» (repost_<id>, TTL 1 час) удалён:
 *    факт репоста живёт на сервере — проверка wall.getReposts выполняется
 *    через Apps Script при каждом открытии карточки, итог пишется в
 *    Answers.has_reposted при отправке ответа.
 */

'use client';

import { useState, useCallback } from 'react';
import { checkRepost, addWallPost } from '@/lib/vk/bridge';
import { logEvent } from '@/lib/sheets/logger';
import { MOCK_MODE } from '@/constants';

export function useRepost(cardId: string, postId: string, vkId: string) {
  const [hasRepost, setHasRepost] = useState<boolean>(false);
  const [checking, setChecking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Проверить статус репоста (серверная проверка через VK API). */
  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const reposted = await checkRepost(vkId, postId);
      setHasRepost(reposted);
      return reposted;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка проверки репоста';
      setError(msg);
      await logEvent('repost_fail', { card_id: cardId, error: msg });
      return false;
    } finally {
      setChecking(false);
    }
  }, [cardId, postId, vkId]);

  /** Сделать репост (VKWebAppShowWallPostBox). */
  const doRepost = useCallback(async () => {
    setPosting(true);
    setError(null);
    await logEvent('repost_click', { card_id: cardId, post_id: postId });
    try {
      const ok = await addWallPost(postId);
      if (ok) {
        // Флаг только в памяти сессии; серверная истина — Answers.has_reposted.
        setHasRepost(true);
        await logEvent('repost_success', { card_id: cardId });
        return true;
      }
      setError('Не удалось сделать репост');
      await logEvent('repost_fail', { card_id: cardId, error: 'addWallPost returned false' });
      return false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка репоста';
      setError(msg);
      await logEvent('repost_fail', { card_id: cardId, error: msg });
      return false;
    } finally {
      setPosting(false);
    }
  }, [cardId, postId]);

  return {
    hasRepost,
    checking,
    posting,
    error,
    check,
    doRepost,
    /** В mock-режиме репост всегда считается сделанным. */
    skipInMock: MOCK_MODE,
  };
}
