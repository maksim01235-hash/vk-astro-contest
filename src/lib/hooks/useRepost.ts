/**
 * lib/hooks/useRepost.ts — хук проверки и выполнения репоста.
 *
 * Логика:
 *  - Проверяет кеш localStorage (1 час TTL) — был ли репост.
 *  - Если нет кеша — вызывает checkRepost (через Apps Script / VK API).
 *  - Если репоста нет — возвращает hasRepost=false (UI покажет модалку).
 *  - После успешного репоста — кеширует на 1 час.
 */

'use client';

import { useState, useCallback } from 'react';
import { checkRepost, addWallPost } from '@/lib/vk/bridge';
import { logEvent } from '@/lib/sheets/logger';
import {
  REPOST_CACHE_TTL_MS,
  STORAGE_REPOST_PREFIX,
  MOCK_MODE,
} from '@/constants';
import { getWithTTL, setWithTTL } from '@/utils/storage';

/** Ключ кеша репоста по карточке. */
function repostKey(cardId: string): string {
  return `${STORAGE_REPOST_PREFIX}${cardId}`;
}

export function useRepost(cardId: string, postId: string, vkId: string) {
  const [hasRepost, setHasRepost] = useState<boolean>(false);
  const [checking, setChecking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Проверить статус репоста. */
  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      // Сначала кеш.
      const cached = getWithTTL<boolean>(repostKey(cardId));
      if (cached) {
        setHasRepost(true);
        return true;
      }
      // Реальная проверка.
      const reposted = await checkRepost(vkId, postId);
      setHasRepost(reposted);
      if (reposted) {
        setWithTTL(repostKey(cardId), true, REPOST_CACHE_TTL_MS);
      }
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

  /** Сделать репост (VKWebAppAddWallPost). */
  const doRepost = useCallback(async () => {
    setPosting(true);
    setError(null);
    await logEvent('repost_click', { card_id: cardId, post_id: postId });
    try {
      const ok = await addWallPost(postId);
      if (ok) {
        setWithTTL(repostKey(cardId), true, REPOST_CACHE_TTL_MS);
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
