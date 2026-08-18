/**
 * components/quiz/RepostModal.tsx — модалка с просьбой сделать репост.
 * Показывается, если пользователь не сделал репост поста конкурса.
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
  onClose: () => void;
  onRepost: () => void;
  posting: boolean;
}

const MODAL_ID = 'repost';

export function RepostModal({ open, onClose, onRepost, posting }: Props) {
  const setModalOpen = useUiStore((s) => s.setModalOpen);
  const openModals = useUiStore((s) => s.openModals);

  // Регистрируем фактическое состояние открытости в общем сторе.
  useEffect(() => {
    setModalOpen(MODAL_ID, open);
    return () => setModalOpen(MODAL_ID, false);
  }, [open, setModalOpen]);

  // Если Header принудительно закрыл все модалки — синхронизируем локальный onClose.
  useEffect(() => {
    if (open && !openModals.has(MODAL_ID)) {
      onClose();
    }
  }, [openModals, open, onClose]);

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
