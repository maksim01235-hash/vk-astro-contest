/**
 * lib/hooks/useCard.ts — хук для работы с карточкой конкурса.
 *
 * Время открытия хранится только в localStorage и НЕ записывается в Logs.
 * Оно используется QuizClient для расчёта delta_seconds в Answers.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { useCardsStore } from '@/lib/store/cardsStore';
import {
  CARDS_CACHE_TTL_MS,
  STORAGE_CARDS_KEY,
  STORAGE_OPEN_TIME_PREFIX,
} from '@/constants';
import { getWithTTL, setWithTTL, setRaw, getRaw } from '@/utils/storage';
import type { CardRecord, CardWithStatus } from '@/types';

function openTimeKey(cardId: string): string {
  return `${STORAGE_OPEN_TIME_PREFIX}${cardId}_open`;
}

export function useCard(cardId: string) {
  const { cards } = useCardsStore();
  const [card, setCard] = useState<CardRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTime, setOpenTime] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);

  const loadCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let found: CardRecord | null = null;
      const cached = getWithTTL<CardRecord[]>(STORAGE_CARDS_KEY);
      if (cached) {
        found = cached.find((c) => String(c.card_id) === String(cardId)) || null;
      }
      if (!found && cards.length > 0) {
        found = cards.find((c) => String(c.card_id) === String(cardId)) || null;
      }
      if (!found) {
        found = await sheetsApi.getCard(cardId);
      }
      if (!found) {
        setError('Карточка не найдена');
      } else {
        setCard(found);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки карточки';
      setError(msg);
      await logEvent('api_error', { action: 'getCard', error: msg });
    } finally {
      setLoading(false);
    }
  }, [cardId, cards]);

  /** Фиксируем время только локально, без записи в Google Sheets. */
  const fixOpenTime = useCallback(() => {
    const key = openTimeKey(cardId);
    let stored = getRaw<number>(key);
    if (!stored) {
      stored = Date.now();
      setRaw(key, stored);
    }
    setOpenTime(stored);
  }, [cardId]);

  useEffect(() => {
    loadCard();
    fixOpenTime();
  }, [loadCard, fixOpenTime]);

  const getCardWithStatus = useCallback(async (): Promise<CardWithStatus | null> => {
    if (!card) return null;
    let nowIso = serverTime;
    if (!nowIso) {
      try {
        nowIso = await sheetsApi.getServerTime();
        setServerTime(nowIso);
      } catch {
        nowIso = new Date().toISOString();
      }
    }
    let status: CardWithStatus['status'] = 'available';
    if (new Date(nowIso).getTime() < new Date(card.release_datetime).getTime()) {
      status = 'locked';
    }
    const result = getRaw<{ submitted: boolean }>(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`);
    if (result?.submitted) status = 'completed';
    return { ...card, status };
  }, [card, cardId, serverTime]);

  return {
    card,
    loading,
    error,
    openTime,
    reload: loadCard,
    getCardWithStatus,
  };
}
