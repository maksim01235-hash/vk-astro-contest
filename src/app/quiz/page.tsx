/**
 * src/app/quiz/page.tsx — страница карточки конкурса через query-параметр.
 *
 * Маршрут: /quiz?id=<card_id>.
 * Карточка может быть добавлена в Sheets после деплоя: static export не требует
 * generateStaticParams и нового билда для каждого ID.
 *
 * Лог отправляется одним запросом вместе с ответом.
 */

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCard } from '@/lib/hooks/useCard';
import { useRepost } from '@/lib/hooks/useRepost';
import { useNotification } from '@/lib/hooks/useNotification';
import { useUserStore } from '@/lib/store/userStore';
import { sheetsApi } from '@/lib/sheets/api.client';
import {
  clearLogBuffer,
  getLogBuffer,
  logEvent,
} from '@/lib/sheets/logger';
import { useToast } from '@/components/ui/Toast';
import { CardRenderer } from '@/components/quiz/CardRenderer';
import { RepostModal } from '@/components/quiz/RepostModal';
import { NotificationModal } from '@/components/quiz/NotificationModal';
import { deltaSeconds, isReleased } from '@/utils/time';
import { safeStringify } from '@/utils/json';
import { getRaw, setRaw } from '@/utils/storage';
import { STORAGE_OFFLINE_QUEUE, STORAGE_OPEN_TIME_PREFIX } from '@/constants';
import type { AnswerPayload, AnswerRecord } from '@/types';

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get('id') || '';

  const { card, loading, error, openTime } = useCard(cardId);
  const { vkUser } = useUserStore();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const repostCheckStarted = useRef(false);
  const cardOpenLoggedRef = useRef('');

  const { hasRepost, check, doRepost, posting } = useRepost(
    cardId,
    card?.post_id || '',
    vkUser?.id || '',
  );

  const {
    showPopup: showNotifPopup,
    request: requestNotif,
    dismiss: dismissNotif,
    requesting: notifRequesting,
  } = useNotification();

  /** Отправить ответ и накопленный журнал одной операцией. */
  const handleSubmit = useCallback(async (payload: AnswerPayload) => {
    if (!vkUser || !card || submitting) return;

    setSubmitting(true);

    try {
      const submitMs = Date.now();
      const startMs = openTime || submitMs;

      // Событие сабмита пишется в буфер до снапшота — лог не бывает пустым.
      await logEvent('card_submit', { card_id: cardId });
      const log = getLogBuffer();

      const answer: AnswerRecord & { log?: typeof log } = {
        id: '0',
        vk_id: vkUser.id,
        card_id: cardId,
        open_timestamp: new Date(startMs).toISOString(),
        submit_timestamp: new Date(submitMs).toISOString(),
        delta_seconds: deltaSeconds(startMs, submitMs),
        user_answer: safeStringify(payload),
        has_reposted: hasRepost,
        log,
      };

      if (!navigator.onLine) {
        // Событие офлайн-сохранения должно попасть в снапшот того же ответа:
        // обновляем log после записи события, до постановки в очередь.
        await logEvent('offline_save', { card_id: cardId });
        answer.log = getLogBuffer();

        const queue = getRaw<AnswerRecord[]>(STORAGE_OFFLINE_QUEUE) || [];
        queue.push(answer);
        setRaw(STORAGE_OFFLINE_QUEUE, queue);
        setRaw(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`, { submitted: true });

        clearLogBuffer();
        toast.info('Нет соединения. Ответ сохранён и будет отправлен позже.');
        router.push(`/thanks?card=${cardId}&offline=1`);
        return;
      }

      await sheetsApi.saveAnswer(answer);
      clearLogBuffer();
      setRaw(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`, { submitted: true });
      toast.success('Ответ отправлен!');
      router.push(`/thanks?card=${cardId}`);
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : 'Ошибка отправки ответа';
      await logEvent('api_error', { action: 'saveAnswer', error: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [card, cardId, hasRepost, openTime, router, submitting, toast, vkUser]);

  /** Проверить репост после успешной загрузки карточки. */
  const handleCardReady = useCallback(async () => {
    if (repostCheckStarted.current || !card || !vkUser || hasRepost) return;

    repostCheckStarted.current = true;
    const reposted = await check();

    if (!reposted) {
      setShowRepostModal(true);
      await logEvent('modal_open', { type: 'repost', card_id: cardId });
    }
  }, [card, cardId, check, hasRepost, vkUser]);

  useEffect(() => {
    if (card && !loading) {
      void handleCardReady();
    }
  }, [card, handleCardReady, loading]);

  /** Зафиксировать открытие карточки в буфере лога — один раз на карточку. */
  useEffect(() => {
    if (!card || loading || cardOpenLoggedRef.current === card.card_id) return;
    cardOpenLoggedRef.current = card.card_id;
    logEvent('card_open', { card_id: card.card_id });
  }, [card, loading]);

  if (!cardId) {
    return (
      <div className="card-surface text-center text-red-500">
        Не указан ID карточки.
      </div>
    );
  }

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
          const ok = await doRepost();
          if (ok) setShowRepostModal(false);
        }}
        posting={posting}
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