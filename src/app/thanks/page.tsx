/**
 * app/thanks/page.tsx — страница благодарности после отправки ответа.
 * Показывает подтверждение и предлагает подписаться на уведомления.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/lib/hooks/useNotification';
import { NotificationModal } from '@/components/quiz/NotificationModal';
import { Suspense, useEffect } from 'react';

function ThanksContent() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get('card') || '';
  const offline = searchParams.get('offline') === '1';
  const { showAfterSubmit, showPopup, request, dismiss, requesting } =
    useNotification();

  useEffect(() => {
    showAfterSubmit();
  }, [showAfterSubmit]);

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="card-surface max-w-md text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Ответ отправлен
        </h1>
        <p className="text-slate-600 mb-6">
          {offline
            ? 'Ответ сохранён и будет отправлен, когда появится соединение.'
            : 'Спасибо за участие в конкурсе!'}
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/" className="btn-primary">
            На главную
          </Link>
          {cardId && (
            <Link href={`/feedback?card=${cardId}`} className="btn-secondary">
              Оставить отзыв
            </Link>
          )}
        </div>
      </div>

      <NotificationModal
        open={showPopup}
        onAllow={request}
        onDismiss={dismiss}
        requesting={requesting}
      />
    </div>
  );
}

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-500">Загрузка...</div>}>
      <ThanksContent />
    </Suspense>
  );
}
