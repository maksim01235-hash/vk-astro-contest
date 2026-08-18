/**
 * app/feedback/page.tsx — форма обратной связи.
 *
 * Обновления (v2):
 *  - Передача log вместе с feedback.
 */

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { sheetsApi } from '@/lib/sheets/api.client';
import { useUserStore } from '@/lib/store/userStore';
import { getLogBuffer, clearLogBuffer } from '@/lib/sheets/logger';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    try {
      const log = getLogBuffer();

      await sheetsApi.saveFeedback({
        card_id: cardId,
        name: name.trim(),
        message: message.trim(),
        vk_id: vkUser?.id || 'anonymous',
        log,
      });

      toast.success('Спасибо за отзыв!');
      clearLogBuffer();
      setName('');
      setMessage('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отправить отзыв');
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
          onChange={(e) => setName(e.target.value)}
          placeholder="Как вас зовут"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Сообщение</label>
          <textarea
            className="input-field min-h-[120px] resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Напишите отзыв или предложение"
            required
          />
        </div>
        <Button type="submit" loading={submitting}>
          Отправить
        </Button>
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