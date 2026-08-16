/**
 * components/ui/Toast.tsx — всплывающее уведомление (toast).
 * Используется для сообщений "Нет соединения", "Ответ сохранён" и т.д.
 * Toast-ы управляются через Zustand store (toastStore).
 */

'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import clsx from 'clsx';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    // Автоудаление через 4 секунды.
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Хук для показа toast-ов из любого компонента. */
export function useToast() {
  const { addToast } = useToastStore();
  return {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    info: (msg: string) => addToast(msg, 'info'),
  };
}

const typeClasses: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-slate-800 text-white',
};

/** Контейнер для отображения всех toast-ов (рендерить в корне). */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'rounded-xl px-4 py-3 shadow-lg text-sm font-medium animate-slide-up cursor-pointer',
            typeClasses[t.type],
          )}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
