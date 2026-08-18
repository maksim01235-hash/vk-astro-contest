/**
 * components/quiz/NotificationModal.tsx — попап "Хочу получать уведомления".
 * Показывается при первом заходе и после отправки ответа.
 *
 * ПРАВКА: регистрируем открытие/закрытие в useUiStore, чтобы Header мог
 * принудительно закрыть эту модалку при клике на "Конкурс" (см. Header.tsx).
 */

'use client';

import { useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/lib/store/uiStore';

interface Props {
  open: boolean;
  onAllow: () => void;
  onDismiss: () => void;
  requesting: boolean;
}

const MODAL_ID = 'notification';

export function NotificationModal({ open, onAllow, onDismiss, requesting }: Props) {
  const setModalOpen = useUiStore((s) => s.setModalOpen);
  const openModals = useUiStore((s) => s.openModals);

  useEffect(() => {
    setModalOpen(MODAL_ID, open);
    return () => setModalOpen(MODAL_ID, false);
  }, [open, setModalOpen]);

  useEffect(() => {
    if (open && !openModals.has(MODAL_ID)) {
      onDismiss();
    }
  }, [openModals, open, onDismiss]);

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
