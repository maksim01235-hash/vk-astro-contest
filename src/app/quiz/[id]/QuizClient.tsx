/**
 * app/quiz/[id]/QuizClient.tsx — клиентская часть страницы карточки конкурса.
 *
 * Server-обёртка в page.tsx экспортирует generateStaticParams и рендерит
 * этот компонент внутри Suspense.
 *
 * Логика:
 *  - Загрузка карточки (useCard).
 *  - Фиксация времени открытия (localStorage).
 *  - Проверка репоста (useRepost) — модалка если нет.
 *  - Рендер через CardRenderer.
 *  - Отправка ответа: вычисление delta, сохранение в Sheets, логирование.
 *  - Попап уведомлений после отправки.
 *  - Оффлайн-очередь при отсутствии сети.
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCard } from '@/lib/hooks/useCard';
import { useRepost } from '@/lib/hooks/useRepost';
import { useNotification } from '@/lib/hooks/useNotification';
import { useUserStore } from '@/lib/store/userStore';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { useToast } from '@/components/ui/Toast';
import { CardRenderer } from '@/components/quiz/CardRenderer';
import { RepostModal } from '@/components/quiz/RepostModal';
import { NotificationModal } from '@/components/quiz/NotificationModal';
import { isReleased } from '@/utils/time';
import { deltaSeconds, nowISO } from '@/utils/time';
import { safeStringify } from '@/utils/json';
import { setRaw, getRaw } from '@/utils/storage';
import { STORAGE_OPEN_TIME_PREFIX, STORAGE_OFFLINE_QUEUE } from '@/constants';
import type { AnswerPayload, AnswerRecord } from '@/types';

export function QuizClient({ cardId }: { cardId: string }) {
  const router = useRouter();
  const { card, loading, error, openTime } = useCard(cardId);
  const { vkUser } = useUserStore();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const { hasRepost, check, doRepost, posting } = useRepost(
    cardId,
    card?.post_id || '',
    vkUser?.id || '',
  );
  const { showPopup: showNotifPopup, request: requestNotif, dismiss: dismissNotif, requesting: notifRequesting } =
    useNotification();

  /** Обработка отправки ответа. */
  const handleSubmit = useCallback(
    async (payload: AnswerPayload) => {
      if (!vkUser || !card) return;
      setSubmitting(true);
      await logEvent('card_submit', { card_id: cardId });

      try {
        // Вычисляем delta.
        const submitMs = Date.now();
        const startMs = openTime || submitMs;
        if (!openTime) {
          // Аномалия: время открытия не найдено.
          await logEvent('api_error', {
            action: 'open_time_missing',
            card_id: cardId,
          });
        }
        const delta = deltaSeconds(startMs, submitMs);

        const answer: AnswerRecord = {
          id: '0', // Apps Script присвоит реальный ID
          vk_id: vkUser.id,
          card_id: cardId,
          open_timestamp: new Date(startMs).toISOString(),
          submit_timestamp: new Date(submitMs).toISOString(),
          delta_seconds: delta,
          user_answer: safeStringify(payload),
          has_reposted: hasRepost,
        };

        // Проверка сети.
        if (!navigator.onLine) {
          // Оффлайн — в очередь.
          const queue = getRaw<AnswerRecord[]>(STORAGE_OFFLINE_QUEUE) || [];
          queue.push(answer);
          setRaw(STORAGE_OFFLINE_QUEUE, queue);
          setRaw(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`, { submitted: true });
          await logEvent('offline_save', { card_id: cardId });
          toast.info('Нет соединения. Ответ сохранён и будет отправлен позже.');
          router.push(`/thanks?card=${cardId}&offline=1`);
          return;
        }

        await sheetsApi.saveAnswer(answer);
        setRaw(`${STORAGE_OPEN_TIME_PREFIX}${cardId}_submitted`, { submitted: true });
        toast.success('Ответ отправлен!');
        router.push(`/thanks?card=${cardId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка отправки ответа';
        await logEvent('api_error', { action: 'saveAnswer', error: msg });
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [vkUser, card, cardId, openTime, hasRepost, router, toast],
  );

  /** При загрузке карточки — проверяем репост. */
  const handleCardReady = useCallback(async () => {
    if (card && vkUser && !hasRepost) {
      const reposted = await check();
      if (!reposted) {
        setShowRepostModal(true);
        await logEvent('modal_open', { type: 'repost', card_id: cardId });
      }
    }
  }, [card, vkUser, hasRepost, check, cardId]);

  // Запускаем проверку репоста после загрузки карточки.
  if (card && !loading && !showRepostModal && !hasRepost) {
    // Вызываем один раз.
    setTimeout(handleCardReady, 0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-surface text-center text-red-500">{error}</div>
    );
  }

  if (!card) {
    return (
      <div className="card-surface text-center text-slate-500">
        Карточка не найдена.
      </div>
    );
  }

  // Проверка: доступна ли карточка по времени.
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
