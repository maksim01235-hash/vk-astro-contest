/**
 * app/page.tsx — главная страница: список карточек конкурса.
 *
 * Логика:
 *  - Авторизация через VK (useAuth).
 *  - Если не авторизован — кнопка "Авторизоваться через VK".
 *  - Загрузка карточек (с кешем 5 минут).
 *  - Отображение статуса: locked (замок), available, completed (галочка).
 *  - Переход только к доступным и неотвеченным.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCardsStore } from '@/lib/store/cardsStore';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { Button } from '@/components/ui/Button';
import {
  CARDS_CACHE_TTL_MS,
  STORAGE_CARDS_KEY,
  STORAGE_OPEN_TIME_PREFIX,
} from '@/constants';
import { getWithTTL, setWithTTL, getRaw } from '@/utils/storage';
import { isReleased, formatDate } from '@/utils/time';
import type { CardRecord, CardWithStatus } from '@/types';

export default function HomePage() {
  const { vkUser, isAuthed, loading: authLoading, login } = useAuth();
  const { cards, setCards, loading, setLoading, error, setError } = useCardsStore();
  const [submittedCards, setSubmittedCards] = useState<Set<string>>(new Set());

  /** Загрузка карточек. */
  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      // Сначала кеш.
      const cached = getWithTTL<CardRecord[]>(STORAGE_CARDS_KEY);
      if (cached) {
        setCards(cached);
        setLoading(false);
        return;
      }
      const data = await sheetsApi.getCards();
      setCards(data);
      setWithTTL(STORAGE_CARDS_KEY, data, CARDS_CACHE_TTL_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки карточек';
      setError(msg);
      await logEvent('api_error', { action: 'getCards', error: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthed) {
      loadCards();
    }
  }, [isAuthed]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Проверка, какие карточки уже отправлены (по localStorage). */
  useEffect(() => {
    const submitted = new Set<string>();
    for (const card of cards) {
      const result = getRaw<{ submitted: boolean }>(
        `${STORAGE_OPEN_TIME_PREFIX}${card.card_id}_submitted`,
      );
      if (result?.submitted) {
        submitted.add(card.card_id);
      }
    }
    setSubmittedCards(submitted);
  }, [cards]);

  /** Вычислить статус карточки. */
  const getStatus = (card: CardRecord): CardWithStatus['status'] => {
    if (submittedCards.has(card.card_id)) return 'completed';
    if (!isReleased(card.release_datetime)) return 'locked';
    return 'available';
  };

  // Не авторизован — показываем кнопку.
  if (!isAuthed && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="card-surface max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Добро пожаловать
          </h1>
          <p className="text-slate-600 mb-6">
            Авторизуйтесь через VK, чтобы участвовать в конкурсе.
          </p>
          <Button onClick={login} loading={authLoading}>
            Авторизоваться через VK
          </Button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Карточки конкурса
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card-surface text-center text-red-500">{error}</div>
      ) : cards.length === 0 ? (
        <div className="card-surface text-center text-slate-500">
          Пока нет карточек конкурса.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card, i) => {
            const status = getStatus(card);
            const isCompleted = status === 'completed';
            const isLocked = status === 'locked';
            return (
              <div
                key={card.card_id}
                className="card-surface flex items-center justify-between hover:shadow-md transition-all duration-200 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {card.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {isLocked
                      ? `Откроется: ${formatDate(card.release_datetime)}`
                      : `Опубликована: ${formatDate(card.release_datetime)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isCompleted && (
                    <span className="text-green-600 text-sm font-medium">
                      Выполнено
                    </span>
                  )}
                  {isLocked && <span className="text-2xl">🔒</span>}
                  {!isLocked && (
                    <Link
                      href={isCompleted ? `/thanks?card=${card.card_id}` : `/quiz/${card.card_id}`}
                      className="btn-secondary text-sm"
                    >
                      {isCompleted ? 'Результат' : 'Открыть'}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
