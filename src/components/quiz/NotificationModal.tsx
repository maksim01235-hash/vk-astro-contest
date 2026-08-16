/**
 * components/quiz/NotificationModal.tsx — попап "Хочу получать уведомления".
 * Показывается при первом заходе и после отправки ответа.
 */

'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onAllow: () => void;
  onDismiss: () => void;
  requesting: boolean;
}

export function NotificationModal({ open, onAllow, onDismiss, requesting }: Props) {
  return (
    <Modal open={open} onClose={onDismiss} title="Уведомления">
      <p className="text-slate-600 mb-4">
        Хотите получать уведомления о новых карточках конкурса и результатах?
      </p>
      <div className="flex flex-col gap-2">
        <Button onClick={onAllow} loading={requesting}>
          Да, разрешить
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Не сейчас
        </Button>
      </div>
    </Modal>
  );
}
