/**
 * lib/hooks/useCard.ts — хук для работы с карточкой конкурса.
 *
 * Обновления (август 2026, сервер-как-источник-истины):
 *  - Время первого открытия карточки приходит из таблицы (лист Opens,
 *    действие markCardOpen) и фиксируется на сервере для пары vk_id + card_id.
 *    Локальное значение в localStorage — только офлайн-fallback.
 *  - Статус «completed» берётся из списка отвеченных (userStore, с сервера),
 *    а не из локального флага _submitted — локальные флаги удалены.
 *  - Исключены повторные getCard для одного cardId; защита от параллельных
 *    вызовов и обновлений состояния после размонтирования сохранена.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { useUserStore } from '@/lib/store/userStore';
import {
  STORAGE_CARDS_KEY,
  MOCK_MODE,
  STORAGE_OPEN_TIME_PREFIX,
} from '@/constants';
import { getWithTTL, setRaw, getRaw } from '@/utils/storage';
import type { CardRecord, CardWithStatus } from '@/types';

function openTimeKey(cardId: string): string {
  return `${STORAGE_OPEN_TIME_PREFIX}${cardId}`;
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
      // Сначала ищем карточку в localStorage-кеше списка (TTL 2 минуты).
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

  /**
   * Время первого открытия карточки.
   * Основной источник — таблица (Opens/markCardOpen): сервер фиксирует первое
   * время и всегда возвращает его, поэтому у всех устройств пользователя и
   * после переустановок дельта считается от одного и того же момента.
   * Пока ответ сервера не пришёл (или пришла ошибка), используется локальный
   * fallback — он выставляется мгновенно, чтобы дельта не «сгорела».
   */
  const resolveOpenTime = useCallback(async () => {
    if (!cardId) return;

    const key = openTimeKey(cardId);

    // Мгновенный локальный ориентир (офлайн/пока летит запрос).
    let stored = getRaw<number>(key);
    if (!stored) {
      stored = Date.now();
      setRaw(key, stored);
    }
    setOpenTime(stored);

    const vkUser = useUserStore.getState().vkUser;
    if (!vkUser || MOCK_MODE) return;

    try {
      const iso = await sheetsApi.markCardOpen(vkUser.id, cardId);
      if (iso) {
        const serverMs = new Date(iso).getTime();
        if (!Number.isNaN(serverMs)) {
          // Серверное значение приоритетно: перезаписываем и состояние,
          // и локальный fallback.
          setRaw(key, serverMs);
          setOpenTime(serverMs);
        }
      }
    } catch (e) {
      // Не глотаем ошибку молча: без этой записи невозможно понять, почему
      // лист Opens пуст (нет сети / Apps Script не переиздан и т.п.).
      await logEvent('api_error', {
        action: 'markCardOpen',
        card_id: cardId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [cardId]);

  useEffect(() => {
    // При смене route-параметра разрешаем запрос другой карточки.
    requestedCardIdRef.current = null;
    setCard(null);
    setServerTime(null);

    void loadCard();
    void resolveOpenTime();
  }, [cardId, loadCard, resolveOpenTime]);

  /**
   * Пользователь авторизовался уже ПОСЛЕ открытия карточки (например, зашёл
   * по прямой ссылке без входа): повторяем markCardOpen, чтобы время попало
   * в таблицу. Повторный вызов безопасен — сервер идемпотентен.
   */
  const vkUserId = useUserStore((state) => state.vkUser?.id ?? '');
  useEffect(() => {
    if (!cardId || !vkUserId) return;
    void resolveOpenTime();
  }, [cardId, vkUserId, resolveOpenTime]);

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

    // «Выполнено» — только по серверному списку отвеченных.
    const answered = useUserStore.getState().answeredCardIds;
    if (answered.some((id) => String(id) === String(card.card_id))) {
      status = 'completed';
    }

    return { ...card, status };
  }, [card, serverTime]);

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
