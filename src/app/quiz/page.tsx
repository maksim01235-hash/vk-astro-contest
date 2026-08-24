/**
 * src/app/quiz/page.tsx — страница карточки конкурса через query-параметр.
 *
 * Маршрут: /quiz?id=<card_id>.
 * Карточка может быть добавлена в Sheets после деплоя: static export не требует
 * generateStaticParams и нового билда для каждого ID.
 *
 * Обновления (август 2026):
 *  - Статус «уже отвечал» определяется только серверным списком
 *    (userStore.answeredCardIds); локальные флаги _submitted удалены.
 *  - После успешной отправки карточка сразу помечается отвеченной в сторе.
 *  - На экране «Вы уже отвечали» добавлена кнопка «На главную».
 *  - Лог отправляется одним запросом вместе с ответом.
 */

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCard } from '@/lib/hooks/useCard';
import { useNotification } from '@/lib/hooks/useNotification';
import { useUserStore } from '@/lib/store/userStore';
import { sheetsApi, isTransportFailure } from '@/lib/sheets/api.client';
import {
  clearLogBuffer,
  getLogBuffer,
  logEvent,
} from '@/lib/sheets/logger';
import { useToast } from '@/components/ui/Toast';
import { CardRenderer } from '@/components/quiz/CardRenderer';
import { NotificationModal } from '@/components/quiz/NotificationModal';
import { deltaSeconds, isReleased } from '@/utils/time';
import { getServerNowMs } from '@/utils/serverClock';
import { safeStringify } from '@/utils/json';
import { getRaw, setRaw } from '@/utils/storage';
import { STORAGE_OFFLINE_QUEUE } from '@/constants';
import type { AnswerPayload, AnswerRecord } from '@/types';

/** «repost_check_unconfigured» пишется один раз за сессию страницы. */
let repostUnconfiguredLogged = false;

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get('id') || '';

  const { card, loading, error, openTime } = useCard(cardId);
  const vkUser = useUserStore((state) => state.vkUser);
  const answeredCardIds = useUserStore((state) => state.answeredCardIds);
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const cardOpenLoggedRef = useRef('');

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
      // Момент отправки — по «серверным часам» (смещение измеряется по ответам
      // API в useCard): локальные часы устройства могут быть смещены, что
      // искажало дельту вплоть до отрицательных значений. Офлайн-ветка
      // использует локальные часы — сервер недоступен by design.
      const submitMs = navigator.onLine ? getServerNowMs() : Date.now();
      const startMs = openTime || submitMs;

      // Событие сабмита пишется в буфер до снапшота — лог не бывает пустым.
      await logEvent('card_submit', { card_id: cardId });
      const log = getLogBuffer();

      let delta = deltaSeconds(startMs, submitMs);
      if (delta < 0) {
        // Защитный клэмп: отрицательная дельта = рассинхрон часов/данных.
        // Пишем 0 и различимое событие для диагностики.
        logEvent('api_error', {
          action: 'delta_clamped',
          card_id: cardId,
          raw_delta_seconds: delta,
          start_ms: startMs,
          submit_ms: submitMs,
        });
        delta = 0;
      }

      // Тихая проверка факта репоста (без модалок и побуждений): один запрос,
      // результат пишется в answer.has_reposted. Сбой проверки не блокирует
      // отправку — фиксируем причину в логе и считаем репост отсутствующим.
      let hasReposted = false;
      if (navigator.onLine && card.post_id) {
        try {
          hasReposted = await sheetsApi.checkRepost(vkUser.id, String(card.post_id));
        } catch (checkError) {
          const reason = checkError instanceof Error ? checkError.message : String(checkError);
          if (reason.includes('REPOST_CHECK_NOT_CONFIGURED')) {
            // Сервис-токен/owner не заданы на сервере: проверки фактически
            // отключены. Пишем различимое событие один раз за сессию.
            if (!repostUnconfiguredLogged) {
              repostUnconfiguredLogged = true;
              logEvent('repost_check_unconfigured', {
                card_id: cardId,
                hint: 'set VK_SERVICE_TOKEN and VK_OWNER_ID in Apps Script properties',
              });
            }
          } else {
            logEvent('repost_fail', {
              card_id: cardId,
              post_id: String(card.post_id),
              reason: 'check_failed',
              error: reason,
            });
          }
        }
      }

      const answer: AnswerRecord & { log?: typeof log } = {
        id: '0',
        vk_id: vkUser.id,
        card_id: cardId,
        open_timestamp: new Date(startMs).toISOString(),
        submit_timestamp: new Date(submitMs).toISOString(),
        delta_seconds: delta,
        user_answer: safeStringify(payload),
        has_reposted: hasReposted,
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

        clearLogBuffer();
        toast.info('Нет соединения. Ответ сохранён и будет отправлен позже.');
        router.push(`/thanks?card=${cardId}&offline=1`);
        return;
      }

      await sheetsApi.saveAnswer(answer);
      clearLogBuffer();
      // Карточка отвечена: сразу отражаем это в локальном списке с сервера.
      useUserStore.getState().addAnsweredCardId(cardId);
      toast.success('Ответ отправлен!');
      router.push(`/thanks?card=${cardId}`);
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : 'Ошибка отправки ответа';

      // Сервер отклонил повторный ответ: фиксируем статус и уводим на результат.
      if (message === 'ANSWER_DUPLICATE') {
        useUserStore.getState().addAnsweredCardId(cardId);
        clearLogBuffer();
        toast.success('Ответ уже принят ранее');
        router.push(`/thanks?card=${cardId}`);
        return;
      }

      // Транспортный сбой (обрыв соединения/таймаут): запись могла пройти,
      // а подтверждение потеряться на редиректе Apps Script. Проверяем факт.
      if (isTransportFailure(submitError) && vkUser) {
        try {
          const alreadySaved = await sheetsApi.hasAnswered(vkUser.id, cardId);
          if (alreadySaved) {
            useUserStore.getState().addAnsweredCardId(cardId);
            clearLogBuffer();
            logEvent('api_error', {
              action: 'saveAnswer',
              error: `${message} (ответ при этом сохранён)`,
            });
            toast.info('Соединение оборвалось, но ответ уже сохранён');
            router.push(`/thanks?card=${cardId}`);
            return;
          }
        } catch {
          // Проверка не удалась — показываем обычную ошибку ниже.
        }
      }

      await logEvent('api_error', { action: 'saveAnswer', error: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [card, cardId, openTime, router, submitting, toast, vkUser]);

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

  // Уже отвечено — строго по серверному списку (обновляется и после отправки).
  const alreadyAnswered = answeredCardIds.some((id) => String(id) === String(cardId));

  if (alreadyAnswered) {
    return (
      <div className="card-surface text-center animate-fade-in">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Вы уже отвечали на эту карточку
        </h2>
        <p className="mb-5 text-slate-600">Повторные ответы не принимаются.</p>
        <div className="flex flex-col gap-2">
          <Link href="/" className="btn-primary">
            На главную
          </Link>
          <Link href={`/thanks?card=${cardId}`} className="btn-secondary">
            Посмотреть результат
          </Link>
        </div>
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
