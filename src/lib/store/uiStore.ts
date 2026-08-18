/**
 * store/uiStore.ts — глобальное состояние UI-оверлеев (Zustand).
 *
 * ПРАВКА (баг): кнопка "Конкурс" в шапке не реагировала на клик, если
 * на странице карточки была открыта RepostModal или NotificationModal.
 * Причина — модалки рендерятся с фиксированным оверлеем z-50 на весь
 * экран (см. components/ui/Modal.tsx), который лежит НАД Header в DOM
 * и перехватывает клик. Клик по ссылке "Конкурс" физически не долетал
 * до <Link>, хотя сам Header работал корректно.
 *
 * Решение: единый реестр "открытых модалок". Header при клике на "Конкурс"
 * принудительно закрывает все зарегистрированные модалки перед переходом,
 * а каждая модалка регистрируется/снимается через этот store.
 */

import { create } from 'zustand';

interface UiState {
  /** Множество идентификаторов открытых модалок ('repost', 'notification', ...). */
  openModals: Set<string>;
  /** Зарегистрировать модалку как открытую/закрытую. */
  setModalOpen: (id: string, open: boolean) => void;
  /** Принудительно закрыть все модалки (вызывается перед навигацией домой). */
  closeAllModals: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  openModals: new Set(),

  setModalOpen: (id, open) =>
    set((state) => {
      const next = new Set(state.openModals);
      if (open) next.add(id);
      else next.delete(id);
      return { openModals: next };
    }),

  closeAllModals: () => set({ openModals: new Set() }),
}));
