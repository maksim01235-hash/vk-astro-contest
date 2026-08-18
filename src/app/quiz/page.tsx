/**
 * app/quiz/page.tsx — страница карточки конкурса (query-based).
 *
 * Обновления (август 2026):
 *  - Заменяет старый динамический маршрут /quiz/[id] на /quiz?id=X.
 *  - ID карточки берётся из useSearchParams(), загружается через sheetsApi.getCard().
 *  - Не требует generateStaticParams — любая новая карточка доступна сразу после добавления в Sheets.
 */

'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useNotification } from '@/lib/hooks/useNotification';
import { useUserStore } from '@/lib/store/userStore';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent, getLogBuffer, clearLogBuffer } from '@/lib/sheets/logger';
import { useToast } from '@/components/ui/Toast';
import { CardRenderer } from '@/components/quiz/CardRenderer';
import { RepostModal } from '@/components/quiz/RepostModal';
import { NotificationModal } from '@/components/quiz/NotificationModal';
import { isReleased } from '@/utils/time';
import { deltaSeconds } from '@/utils/time';
import { safeStringify } from '@/utils/json';
import { setRaw } from '@/utils/storage';
import { STORAGE_OPEN_TIME_PREFIX, STORAGE_OFFLINE_QUEUE } from '@/constants';
import type { AnswerPayload, AnswerRecord, CardRecord } from '@/types';

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get('id') || '';
  const { vkUser } = useUserStore();
  const toast = useToast();

  const [card, setCard] = useState<CardRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTime, setOpenTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const repostCheckStarted = useRef(false);

  const {
    showPopup: showNotifPopup,
    request: requestNotif,
    dismiss: dismissNotif,
    requesting: notifRequesting,
  } = useNotification();

  // Проверка репоста (ленивая, один раз).
  const [hasRepost, setHasRepost] = useState(false);
  const [checkingRepost, setCheckingRepost] = useState(false);

  const checkRepost = useCallback(async () => {
    if (!card || !vkUser || checkingRepost) return;
    setCheckingRepost(true);
    try {
      const reposted = await sheetsApi.checkRepost(vkUser.id, card.post_id || '');
      setHasRepost(reposted);
      if (!reposted) {
        setShowRepostModal(true);
        await logEvent('modal_open', { type: 'repost', card_id: cardId });
      }
    } catch (e) {
      await logEvent('api_error', { action: 'checkRepost', error: String(e) });
    }
  }, [card, vkUser, checkingRepost, cardId]);

  /** Загрузка карточки. */
  const loadCard = useCallback(async () => {
    if (!cardId) {
      setError('Не указан ID карточки');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const found = await sheetsApi.getCard(cardId);
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
  }, [cardId]);

  /** Фиксация времени открытия (локально, в localStorage). */
  const fixOpenTime = useCallback(() => {
    const key = `${STORAGE_OPEN_TIME_PREFIX}${cardId}_open`;
    let stored = Number(localStorage.getItem(key) || 0);
    if (!stored) {
      stored = Date.now();
      localStorage.setItem(key, String(stored));
    }
    setOpenTime(stored);
  }, [cardId]);

  useEffect(() => {
    loadCard();
    fixOpenTime();
  }, [loadCard, fixOpenTime]);

  useEffect(() => {
    if (card && !loading && !repostCheckStarted.current) {
      repostCheckStarted.current = true;
      checkRepost();
    }
  }, [card, loading, checkRepost]);

  /** Отправка ответа. */
  const handleSubmit = useCallback(
    async (payload: AnswerPayload) => {
      if (!vkUser || !card || submitting) return;
      setSubmitting(true);

      try {
        const submitMs = Date.now();
        const startMs = openTime || submitMs;
        const delta = deltaSeconds(startMs, submitMs);

        // Получаем накопленный лог.
        const log = getLogBuffer();

        const answer: AnswerRecord & { log?: typeof log } = {
          id: '0',
          vk_id: vkUser.id,
          card_id: cardId,
          open_timestamp: new Date(startMs).toISOString(),
          submit_timestamp: new Date(submitMs).toISOString(),
          delta_seconds: delta,
          user_answer: safeStringify(payload),
          has_reposted: hasRepost,
          log,
        };

        if (!navigator.onLine) {
          const queue = JSON.parse(localStorage.getItem(STORAGE_OFFLINE_QUEUE) || '[]');
          queue.push(answer);
          localStorage.setItem(STORAGE_OFFLINE_QUEUE, JSON.stringify(queue));
          setRaw(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`, { submitted: true });
          await logEvent('offline_save', { card_id: cardId });
          toast.info('Нет соединения. Ответ сохранён и будет отправлен позже.');
          router.push(`/thanks?card=${cardId}&offline=1`);
          clearLogBuffer();
          return;
        }

        await sheetsApi.saveAnswer(answer);
        setRaw(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`, { submitted: true });
        toast.success('Ответ отправлен!');
        router.push(`/thanks?card=${cardId}`);
        clearLogBuffer();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка отправки ответа';
        await logEvent('api_error', { action: 'saveAnswer', error: msg });
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [vkUser, card, cardId, openTime, hasRepost, submitting, router, toast],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="card-surface text-center text-red-500">{error}</div>;
  }

  if (!card) {
    return <div className="card-surface text-center text-slate-500">Карточка не найдена.</div>;
  }

  if (!isReleased(card.release_datetime)) {
    return (
      <div className="card-surface text-center animate-fade-in">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Карточка ещё не открыта
        </h2>
        <p className="text-slate-600">
          Время открытия: {new Date(card.release_datetime).toLocaleString('ru-RU')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">{card.title}</h1>
      <CardRenderer
        jsonSchema={card.json_schema}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
      <RepostModal
        open={showRepostModal}
        onClose={() => setShowRepostModal(false)}
        onRepost={async () => {
          const ok = await sheetsApi.checkRepost(vkUser!.id, card.post_id || '');
          if (ok) {
            setHasRepost(true);
            setShowRepostModal(false);
          }
        }}
        posting={checkingRepost}
      />
      <NotificationModal
        open={showNotifPopup}
        onAllow={requestNotif}
        onDismiss={dismissNotif}
        requesting={notifRequesting}
      />
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}