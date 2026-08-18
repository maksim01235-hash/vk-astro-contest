/**
 * app/feedback/page.tsx — страница обратной связи.
 *
 * Обновления (август 2026):
 *  - Передача накопленного лога вместе с отправкой фидбэка.
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUserStore } from '@/lib/store/userStore';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent, getLogBuffer, clearLogBuffer } from '@/lib/sheets/logger';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function FeedbackPage() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get('card') || '';
  const { vkUser } = useUserStore();
  const toast = useToast();

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (vkUser) {
      setName(`${vkUser.first_name} ${vkUser.last_name}`.trim());
    }
  }, [vkUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Введите сообщение');
      return;
    }
    if (!vkUser) {
      toast.error('Требуется авторизация');
      return;
    }

    setSending(true);
    try {
      // Получаем накопленный лог.
      const log = getLogBuffer();

      await sheetsApi.saveFeedback({
        card_id: cardId,
        name,
        message: message.trim(),
        vk_id: vkUser.id,
        log,
      });

      toast.success('Спасибо за ваш отзыв!');
      clearLogBuffer();
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка отправки';
      await logEvent('api_error', { action: 'saveFeedback', error: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="card-surface max-w-md w-full">
        <h1 className="text-2xl font-bold text-slate-900 mb-4 text-center">
          Обратная связь
        </h1>
        {cardId && (
          <p className="text-sm text-slate-500 mb-4 text-center">
            Карточка: {cardId}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Сообщение
            </label>
            <textarea
              className="input-field min-h-[120px] resize-y"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Опишите проблему или предложение"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={sending}>
              Отправить
            </Button>
            <Link href="/" className="btn-secondary text-sm">
              Отмена
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}