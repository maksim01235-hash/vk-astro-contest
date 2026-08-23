/**
 * src/app/page.tsx — главная: список карточек конкурса.
 *
 * Обновления (август 2026, сервер-как-источник-истины):
 *  - Статус «Выполнено» определяется только серверным списком отвеченных
 *    карточек (userStore.answeredCardIds); локальные флаги _submitted удалены.
 *  - Кеш списка в localStorage сокращён до 2 минут (константа CARDS_CACHE_TTL_MS).
 */

'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUserStore } from '@/lib/store/userStore';
import { useCardsStore } from '@/lib/store/cardsStore';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { Button } from '@/components/ui/Button';
import { CARDS_CACHE_TTL_MS, STORAGE_CARDS_KEY } from '@/constants';
import { getWithTTL, setWithTTL } from '@/utils/storage';
import { isReleased, formatDate } from '@/utils/time';
import type { CardRecord } from '@/types';

export default function HomePage() {
  const { isAuthed, loading: authLoading, login } = useAuth();
  const answeredCardIds = useUserStore((state) => state.answeredCardIds);
  const { cards, setCards, loading, setLoading, error, setError } = useCardsStore();

  /** Карточки, на которые пользователь уже ответил — только с сервера. */
  const submittedCards = useMemo(
    () => new Set(answeredCardIds.map(String)),
    [answeredCardIds],
  );

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
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
    if (isAuthed) void loadCards();
  }, [isAuthed]);

  const getStatus = (card: CardRecord): 'locked' | 'available' | 'completed' => {
    if (submittedCards.has(String(card.card_id))) return 'completed';
    if (!isReleased(card.release_datetime)) return 'locked';
    return 'available';
  };

  if (!isAuthed && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="card-surface max-w-md text-center">
          <h1 className="mb-3 text-2xl font-bold text-slate-900">Добро пожаловать</h1>
          <p className="mb-3 text-slate-600">Авторизуйтесь через VK, чтобы участвовать в конкурсе.</p>
          <p className="mb-6 rounded-xl bg-slate-100 px-4 py-3 text-left text-xs leading-relaxed text-slate-600">
            Ваши ответы и ссылка на ваш профиль будут видны автору конкурса.
          </p>
          <Button onClick={login} loading={authLoading}>Авторизоваться через VK</Button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent/30 border-t-accent" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Карточки конкурса</h1>
      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent/30 border-t-accent" /></div>
      ) : error ? (
        <div className="card-surface text-center text-red-500">{error}</div>
      ) : cards.length === 0 ? (
        <div className="card-surface text-center text-slate-500">Пока нет карточек конкурса.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card, i) => {
            const status = getStatus(card);
            const isCompleted = status === 'completed';
            const isLocked = status === 'locked';
            return (
              <div key={card.card_id} className="card-surface flex items-center justify-between gap-4 hover:shadow-md" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 font-semibold text-slate-900">{card.title}</h3>
                  <p className="text-sm text-slate-500">{isLocked ? `Откроется: ${formatDate(card.release_datetime)}` : `Опубликована: ${formatDate(card.release_datetime)}`}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {isCompleted && <span className="inline-flex min-h-[46px] items-center text-sm font-medium text-green-600">Выполнено</span>}
                  {isLocked && <span className="text-2xl">🔒</span>}
                  {!isLocked && <Link href={isCompleted ? `/thanks?card=${card.card_id}` : `/quiz?id=${card.card_id}`} className="btn-secondary text-sm">{isCompleted ? 'Результат' : 'Открыть'}</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
