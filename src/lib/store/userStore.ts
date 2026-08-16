/**
 * store/userStore.ts — глобальное состояние пользователя (Zustand).
 * Хранит VK ID, имя, фото, статус авторизации, флаг подписки.
 *
 * Зачем: доступ к пользователю из любого компонента без prop drilling.
 */

import { create } from 'zustand';
import type { VKUserInfo, UserRecord } from '@/types';
import { STORAGE_VK_USER_KEY } from '@/constants';
import { getRaw, setRaw, remove } from '@/utils/storage';

interface UserState {
  /** VK-данные пользователя (из VK Bridge). */
  vkUser: VKUserInfo | null;
  /** Запись из Google Sheets (Users). */
  userRecord: UserRecord | null;
  /** Авторизован ли (получен VK ID). */
  isAuthed: boolean;
  /** Загрузка. */
  loading: boolean;

  /** Установить VK-пользователя (после VK Bridge). */
  setVkUser: (user: VKUserInfo) => void;
  /** Установить запись из Sheets. */
  setUserRecord: (record: UserRecord) => void;
  /** Установить флаг загрузки. */
  setLoading: (v: boolean) => void;
  /** Сбросить (выход). */
  reset: () => void;
  /** Восстановить из localStorage. */
  hydrate: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  vkUser: null,
  userRecord: null,
  isAuthed: false,
  loading: false,

  setVkUser: (user) => {
    setRaw(STORAGE_VK_USER_KEY, user);
    set({ vkUser: user, isAuthed: true });
  },

  setUserRecord: (record) => set({ userRecord: record }),

  setLoading: (v) => set({ loading: v }),

  reset: () => {
    remove(STORAGE_VK_USER_KEY);
    set({ vkUser: null, userRecord: null, isAuthed: false, loading: false });
  },

  hydrate: () => {
    const saved = getRaw<VKUserInfo>(STORAGE_VK_USER_KEY);
    if (saved) {
      set({ vkUser: saved, isAuthed: true });
    }
  },
}));
