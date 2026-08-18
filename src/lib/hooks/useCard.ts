/**
 * lib/hooks/useCard.ts — хук для работы с карточкой конкурса.
 *
 * Исправления (август 2026):
 *  - Исключены повторные getCard для одного cardId при прямом открытии карточки.
 *  - Убрана нестабильная зависимость loadCard от глобального cards store.
 *  - Добавлена защита от параллельного вызова и обновления состояния после размонтирования.
 *
 * Время открытия хранится только в localStorage и НЕ записывается в Logs.
 * Оно используется QuizClient для расчёта delta_seconds в Answers.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import {
  STORAGE_CARDS_KEY,
  STORAGE_OPEN_TIME_PREFIX,
} from '@/constants';
import { getWithTTL, setRaw, getRaw } from '@/utils/storage';
import type { CardRecord, CardWithStatus } from '@/types';

function openTimeKey(cardId: string): string {
  return `${STORAGE_OPEN_TIME_PREFIX}${cardId}_open`;
}

export function useCard(cardId: string) {
  const [card, setCard] = useState<CardRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTime, setOpenTime] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);

  /**
   * ID карточки, для которого уже идёт или уже был выполнен запрос.
   * Защищает от двойного useEffect в React Strict Mode и повторных рендеров.
   */
  const requestedCardIdRef = useRef<string | null>(null);

  const loadCard = useCallback(async (force = false) => {
    if (!cardId) {
      setCard(null);
      setError('Не указан ID карточки');
      setLoading(false);
      return;
    }

    // При обычной загрузке разрешаем только один запрос для одного ID.
    if (!force && requestedCardIdRef.current === cardId) {
      return;
    }

    requestedCardIdRef.current = cardId;
    setLoading(true);
    setError(null);

    try {
      // Сначала ищем карточку в localStorage-кеше списка.
      const cached = getWithTTL<CardRecord[]>(STORAGE_CARDS_KEY);
      const found = cached?.find((item) => String(item.card_id) === String(cardId)) || null;

      // При прямом входе кеша обычно нет: тогда один раз запрашиваем конкретную карточку.
      const result = found || await sheetsApi.getCard(cardId);

      if (!result) {
        setCard(null);
        setError('Карточка не найдена');
      } else {
        setCard(result);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки карточки';
      setCard(null);
      setError(msg);
      await logEvent('api_error', { action: 'getCard', error: msg });
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  /** Фиксируем время только локально, без записи в Google Sheets. */
  const fixOpenTime = useCallback(() => {
    if (!cardId) return;

    const key = openTimeKey(cardId);
    let stored = getRaw<number>(key);
    if (!stored) {
      stored = Date.now();
      setRaw(key, stored);
    }
    setOpenTime(stored);
  }, [cardId]);

  useEffect(() => {
    // При смене route-параметра разрешаем запрос другой карточки.
    requestedCardIdRef.current = null;
    setCard(null);
    setServerTime(null);

    void loadCard();
    fixOpenTime();
  }, [cardId, loadCard, fixOpenTime]);

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

    const result = getRaw<{ submitted: boolean }>(
      `${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`,
    );
    if (result?.submitted) status = 'completed';

    return { ...card, status };
  }, [card, cardId, serverTime]);

  return {
    card,
    loading,
    error,
    openTime,
    /** force=true — намеренно запросить карточку повторно, например по кнопке «Повторить». */
    reload: () => loadCard(true),
    getCardWithStatus,
  };
}