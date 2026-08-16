/**
 * components/quiz/RepostModal.tsx — модалка с просьбой сделать репост.
 * Показывается, если пользователь не сделал репост поста конкурса.
 */

'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
  onRepost: () => void;
  posting: boolean;
}

export function RepostModal({ open, onClose, onRepost, posting }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Сделайте репост">
      <p className="text-slate-600 mb-4">
        Чтобы участвовать в конкурсе, сделайте репост записи на стене.
        После репоста карточка станет доступна.
      </p>
      <div className="flex flex-col gap-2">
        <Button onClick={onRepost} loading={posting}>
          Сделать репост
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Позже
        </Button>
      </div>
    </Modal>
  );
}
