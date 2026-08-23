/**
 * src/lib/sheets/api.client.ts — клиент Google Apps Script REST API.
 *
 * Гарантии (август 2026):
 *  - Single-flight по действию: мутации при активном запросе того же действия
 *    отклоняются ошибкой «Предыдущий запрос ещё выполняется»; чтения
 *    коалесцируются в общий выполняющийся промис.
 *  - Мутации без авто-ретраев: повтор после таймаута мог бы задвоить запись
 *    на сервере (клиент не знает, дошёл ли первый запрос).
 *  - Таймауты per-action: тяжёлым операциям (stats/syncOffline/saveCard) — 30 c.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  API_ACTIONS,
  REQUEST_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
  RETRY_COUNT,
  SHEETS_API_URL,
} from '@/constants';
import type {
  AnswerRecord,
  ApiResponse,
  CardRecord,
  CardStat,
  LogRecord,
  UserRecord,
} from '@/types';

/** Таймауты отдельных действий (мс); остальные используют REQUEST_TIMEOUT_MS. */
const ACTION_TIMEOUT_MS: Record<string, number> = {
  [API_ACTIONS.GET_STATS]: 30000,
  [API_ACTIONS.SYNC_OFFLINE]: 30000,
  [API_ACTIONS.SAVE_CARD]: 30000,
};

const BUSY_MESSAGE = 'Предыдущий запрос ещё выполняется';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client: AxiosInstance = axios.create({
  baseURL: SHEETS_API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
});

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_COUNT; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isNetwork = error instanceof AxiosError && !error.response;
      const is5xx = error instanceof AxiosError && !!error.response && error.response.status >= 500;

      if (!isNetwork && !is5xx) throw error;
      if (attempt < RETRY_COUNT - 1) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

function parseResponse<T>(raw: unknown): T {
  return typeof raw === 'string' ? JSON.parse(raw) as T : raw as T;
}

async function get<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const response = await withRetry(() =>
    client.get('', { params: { action, ...params }, timeout: ACTION_TIMEOUT_MS[action] }),
  );
  const result = parseResponse<ApiResponse<T>>(response.data);
  if (!result.ok) throw new Error(result.error || `${action} failed`);
  return result.data as T;
}

async function post<T = unknown>(action: string, body: unknown): Promise<T> {
  const response = await client.post('', JSON.stringify(body), {
    params: { action },
    timeout: ACTION_TIMEOUT_MS[action],
  });
  const result = parseResponse<ApiResponse<T>>(response.data);
  if (!result.ok) throw new Error(result.error || `${action} failed`);
  return result.data as T;
}

/**
 * Одновременно может выполняться один запрос действия:
 *  - 'coalesce' — чтения дожидаются уже летящего запроса (общий промис);
 *  - 'single'   — мутации: новый вызов отклоняется, в очередь не встаёт.
 */
const inflight = new Map<string, Promise<unknown>>();

function gate<T>(
  key: string,
  mode: 'coalesce' | 'single',
  run: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    if (mode === 'coalesce') return existing;
    return Promise.reject(new Error(BUSY_MESSAGE));
  }

  const promise = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export const sheetsApi = {
  getCards(): Promise<CardRecord[]> {
    return gate(API_ACTIONS.GET_CARDS, 'coalesce', async () => {
      const data = await get<CardRecord[]>(API_ACTIONS.GET_CARDS);
      return data || [];
    });
  },

  getCardsList(): Promise<Array<{ card_id: string; title: string; is_active: boolean }>> {
    return gate(API_ACTIONS.GET_CARDS_LIST, 'coalesce', async () => {
      const data = await get<Array<{ card_id: string; title: string; is_active: boolean }>>(
        API_ACTIONS.GET_CARDS_LIST,
      );
      return data || [];
    });
  },

  getCard(cardId: string): Promise<CardRecord | null> {
    return gate(`${API_ACTIONS.GET_CARD}:${cardId}`, 'coalesce', () =>
      get<CardRecord | null>(API_ACTIONS.GET_CARD, { id: cardId }),
    );
  },

  checkUser(vkId: string, name?: string): Promise<UserRecord> {
    return gate(`${API_ACTIONS.CHECK_USER}:${vkId}`, 'coalesce', () =>
      get<UserRecord>(API_ACTIONS.CHECK_USER, {
        vk_id: vkId,
        name: name || '',
      }),
    );
  },

  /** Карточки, на которые пользователь уже ответил. */
  getAnsweredCards(vkId: string): Promise<string[]> {
    return gate(`${API_ACTIONS.GET_ANSWERED_CARDS}:${vkId}`, 'coalesce', async () => {
      const data = await get<string[]>(API_ACTIONS.GET_ANSWERED_CARDS, { vk_id: vkId });
      return data || [];
    });
  },

  saveUser(user: UserRecord): Promise<void> {
    return gate(API_ACTIONS.SAVE_USER, 'single', async () => {
      await post(API_ACTIONS.SAVE_USER, user);
    });
  },

  saveAnswer(answer: AnswerRecord & { log?: LogRecord[] }): Promise<void> {
    return gate(API_ACTIONS.SAVE_ANSWER, 'single', async () => {
      await post(API_ACTIONS.SAVE_ANSWER, answer);
    });
  },

  saveFeedback(feedback: {
    card_id: string;
    name: string;
    message: string;
    vk_id: string;
    log?: LogRecord[];
  }): Promise<void> {
    return gate(API_ACTIONS.SAVE_FEEDBACK, 'single', async () => {
      await post(API_ACTIONS.SAVE_FEEDBACK, feedback);
    });
  },

  /**
   * Ручная отправка лога из админки (кнопка "Отправить лог").
   * Пишет одну строку в лист Logs с vk_id="admin" на стороне Apps Script.
   */
  saveManualLog(log: LogRecord[]): Promise<{ saved: boolean; count: number }> {
    return gate(API_ACTIONS.SAVE_MANUAL_LOG, 'single', () =>
      post<{ saved: boolean; count: number }>(API_ACTIONS.SAVE_MANUAL_LOG, { log }),
    );
  },

  getStats(): Promise<CardStat[]> {
    return gate(API_ACTIONS.GET_STATS, 'coalesce', async () => {
      const data = await get<CardStat[]>(API_ACTIONS.GET_STATS);
      return data || [];
    });
  },

  /**
   * Сохранение карточки. is_edit=true — обновление существующей,
   * is_edit=false — создание новой; строгий режим проверяет это на сервере.
   */
  saveCard(card: CardRecord & { is_edit?: boolean }): Promise<{ saved: boolean; created: boolean }> {
    return gate(API_ACTIONS.SAVE_CARD, 'single', () =>
      post<{ saved: boolean; created: boolean }>(API_ACTIONS.SAVE_CARD, card),
    );
  },

  checkRepost(vkId: string, postId: string): Promise<boolean> {
    return gate(`${API_ACTIONS.CHECK_REPOST}:${vkId}:${postId}`, 'coalesce', () =>
      get<boolean>(API_ACTIONS.CHECK_REPOST, {
        vk_id: vkId,
        post_id: postId,
      }),
    );
  },

  getServerTime(): Promise<string> {
    return gate(API_ACTIONS.GET_SERVER_TIME, 'coalesce', async () => {
      const data = await get<{ iso: string }>(API_ACTIONS.GET_SERVER_TIME);
      return data?.iso || new Date().toISOString();
    });
  },

  /**
   * Зафиксировать факт открытия карточки и получить время первого просмотра.
   * Сервер (лист Opens) под лока́том записывает первое время для пары
   * vk_id + card_id и возвращает его; повторные вызовы отдают то же значение.
   * @returns ISO-строка времени первого открытия либо '' при сбое.
   */
  markCardOpen(vkId: string, cardId: string): Promise<string> {
    return gate(`${API_ACTIONS.MARK_CARD_OPEN}:${vkId}:${cardId}`, 'coalesce', async () => {
      const data = await get<{ iso: string }>(API_ACTIONS.MARK_CARD_OPEN, {
        vk_id: vkId,
        card_id: cardId,
      });
      return data?.iso || '';
    });
  },

  syncOffline(answers: AnswerRecord[]): Promise<{ saved: number; skipped: number }> {
    return gate(API_ACTIONS.SYNC_OFFLINE, 'single', async () => {
      const data = await post<{ saved: number; skipped: number }>(API_ACTIONS.SYNC_OFFLINE, { answers });
      return { saved: data?.saved || 0, skipped: data?.skipped || 0 };
    });
  },
};
