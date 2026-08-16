/**
 * lib/hooks/useCard.ts — хук для работы с карточкой конкурса.
 *
 * Логика:
 *  - Загружает карточку по ID (с кешем localStorage на 5 минут).
 *  - Фиксирует время открытия карточки в localStorage.
 *  - Вычисляет статус карточки для пользователя.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { useUserStore } from '@/lib/store/userStore';
import { useCardsStore } from '@/lib/store/cardsStore';
import {
  CARDS_CACHE_TTL_MS,
  STORAGE_CARDS_KEY,
  STORAGE_OPEN_TIME_PREFIX,
} from '@/constants';
import { getWithTTL, setWithTTL, setRaw, getRaw } from '@/utils/storage';
import type { CardRecord, CardWithStatus } from '@/types';

/** Ключ времени открытия карточки в localStorage. */
function openTimeKey(cardId: string): string {
  return `${STORAGE_OPEN_TIME_PREFIX}${cardId}_open`;
}

export function useCard(cardId: string) {
  const { cards } = useCardsStore();
  const { vkUser } = useUserStore();
  const [card, setCard] = useState<CardRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTime, setOpenTime] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);

  /** Загрузка карточки (с кешем). */
  const loadCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Сначала ищем в общем кеше списка карточек.
      let found: CardRecord | null = null;
      const cached = getWithTTL<CardRecord[]>(STORAGE_CARDS_KEY);
      if (cached) {
        found = cached.find((c) => c.card_id === cardId) || null;
      }
      // Если в кеше нет — ищем в store (если список уже загружен).
      if (!found && cards.length > 0) {
        found = cards.find((c) => c.card_id === cardId) || null;
      }
      // Если нигде нет — запрашиваем у API.
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

  /** Фиксация времени открытия карточки. */
  const fixOpenTime = useCallback(async () => {
    const key = openTimeKey(cardId);
    let stored = getRaw<number>(key);
    if (!stored) {
      stored = Date.now();
      setRaw(key, stored);
      await logEvent('card_open', { card_id: cardId, open_timestamp: stored });
    }
    setOpenTime(stored);
  }, [cardId]);

  useEffect(() => {
    loadCard();
    fixOpenTime();
  }, [loadCard, fixOpenTime]);

  /** Вычислить статус карточки (с использованием серверного времени). */
  const getCardWithStatus = useCallback(async (): Promise<CardWithStatus | null> => {
    if (!card) return null;
    // Получаем серверное время один раз (кешируем в state).
    let nowIso = serverTime;
    if (!nowIso) {
      try {
        nowIso = await sheetsApi.getServerTime();
        setServerTime(nowIso);
      } catch {
        // Fallback на клиентское время.
        nowIso = new Date().toISOString();
      }
    }
    let status: CardWithStatus['status'] = 'available';
    if (new Date(nowIso).getTime() < new Date(card.release_datetime).getTime()) {
      status = 'locked';
    }
    // Проверка, отправлен ли ответ — через localStorage (упрощённо для MVP).
    const result = getRaw<{ submitted: boolean }>(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`);
    if (result?.submitted) {
      status = 'completed';
    }
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
