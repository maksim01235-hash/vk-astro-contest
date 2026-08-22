/**
 * src/components/admin/AdminLogButton.tsx — кнопка "Отправить лог" для админ-страниц.
 *
 * Поведение (вариант B, согласовано):
 *  1. Клик по кнопке добавляет событие admin_manual_log_submit в буфер и
 *     открывает модалку с предпросмотром накопленного JSON-лога.
 *  2. Администратор подтверждает отправку или отменяет её.
 *  3. При подтверждении лог уходит одной записью через saveManualLog
 *     (vk_id="admin" на сервере), затем буфер очищается.
 *  4. При ошибке буфер не очищается — можно повторить попытку.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { sheetsApi } from '@/lib/sheets/api.client';
import { clearLogBuffer, getLogBuffer, logEvent } from '@/lib/sheets/logger';

interface Props {
  /** Название текущей страницы — попадает в event_data события. */
  page: string;
}

export function AdminLogButton({ page }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState('');
  const [count, setCount] = useState(0);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  /** Открыть модалку предпросмотра и зафиксировать сам факт открытия в лог. */
  const handleOpenPreview = async () => {
    await logEvent('admin_manual_log_submit', { source: 'admin', page });

    const buffer = getLogBuffer();
    setCount(buffer.length);
    setPreview(JSON.stringify(buffer, null, 2));
    setOpen(true);
  };

  /** Подтвердить отправку: один запрос, затем очистка буфера при успехе. */
  const handleConfirmSend = async () => {
    setSending(true);
    try {
      const buffer = getLogBuffer();
      await sheetsApi.saveManualLog(buffer);
      clearLogBuffer();
      toast.success(`Лог отправлен (${buffer.length} событий)`);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось отправить лог';
      toast.error(message);
      // Буфер намеренно не очищается — можно повторить отправку.
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpenPreview}>
        Отправить лог
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Отправка технического лога">
        <p className="text-sm text-slate-600 mb-3">
          Накоплено событий: <span className="font-semibold">{count}</span>
        </p>
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 max-h-72 overflow-y-auto overflow-x-auto">
          {preview || '[]'}
        </pre>
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={handleConfirmSend} loading={sending} disabled={count === 0}>
            Отправить
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={sending}>
            Отмена
          </Button>
        </div>
      </Modal>
    </>
  );
}