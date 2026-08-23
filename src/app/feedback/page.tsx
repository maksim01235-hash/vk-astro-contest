/**
 * src/app/feedback/page.tsx — форма обратной связи.
 *
 * Накопленный лог передаётся одним запросом вместе с обратной связью.
 */

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { sheetsApi } from '@/lib/sheets/api.client';
import { useUserStore } from '@/lib/store/userStore';
import { clearLogBuffer, getLogBuffer, logEvent } from '@/lib/sheets/logger';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

function FeedbackContent() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get('card') || '';
  const { vkUser } = useUserStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);

    try {
      // Событие отправки фидбека пишется в буфер до снапшота — лог не бывает пустым.
      logEvent('feedback_submit', { card_id: cardId });
      const log = getLogBuffer();

      await sheetsApi.saveFeedback({
        card_id: cardId,
        name: name.trim(),
        message: message.trim(),
        vk_id: vkUser?.id || 'anonymous',
        log,
      });

      clearLogBuffer();
      toast.success('Спасибо за отзыв!');
      setName('');
      setMessage('');
    } catch (feedbackError) {
      const errorMessage = feedbackError instanceof Error
        ? feedbackError.message
        : 'Не удалось отправить отзыв';
      await logEvent('api_error', {
        action: 'saveFeedback',
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Обратная связь</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Ваше имя"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Как вас зовут"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Сообщение</label>
          <textarea
            className="input-field min-h-[120px] resize-y"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Напишите отзыв или предложение"
            required
          />
        </div>
        <Button type="submit" loading={submitting}>Отправить</Button>
      </form>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-500">Загрузка...</div>}>
      <FeedbackContent />
    </Suspense>
  );
}