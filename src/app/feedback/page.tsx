/**
 * app/feedback/page.tsx — простая форма обратной связи.
 * Сохраняет отзыв в таблицу Logs (как событие feedback).
 */

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { logEvent } from '@/lib/sheets/logger';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

function FeedbackContent() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get('card') || '';
  const toast = useToast();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await logEvent('feedback', { card_id: cardId, name, message });
      toast.success('Спасибо за отзыв!');
      setName('');
      setMessage('');
    } catch {
      toast.error('Не удалось отправить отзыв');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Обратная связь
      </h1>
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
