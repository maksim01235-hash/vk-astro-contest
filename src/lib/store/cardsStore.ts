/**
 * store/cardsStore.ts — глобальное состояние карточек (Zustand).
 * Хранит список карточек, кеш, состояние загрузки.
 */

import { create } from 'zustand';
import type { CardRecord } from '@/types';

interface CardsState {
  cards: CardRecord[];
  loading: boolean;
  error: string | null;
  /** Установить список карточек. */
  setCards: (cards: CardRecord[]) => void;
  /** Установить загрузку. */
  setLoading: (v: boolean) => void;
  /** Установить ошибку. */
  setError: (e: string | null) => void;
  /** Сбросить. */
  reset: () => void;
}

export const useCardsStore = create<CardsState>((set) => ({
  cards: [],
  loading: false,
  error: null,
  setCards: (cards) => set({ cards }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  reset: () => set({ cards: [], loading: false, error: null }),
}));
