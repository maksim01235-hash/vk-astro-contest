/**
 * components/ui/Modal.tsx — модальное окно с плавным появлением.
 * Используется для попапа репоста, уведомлений, подтверждений.
 */

'use client';

import { ReactNode, useEffect } from 'react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  // Блокировка скролла body при открытом модальном окне.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={clsx(
          'bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
