/**
 * src/lib/sheets/api.client.ts — клиент Google Apps Script REST API.
 *
 * Добавлено: saveManualLog для кнопки "Отправить лог" в админке.
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
    client.get('', { params: { action, ...params } }),
  );
  const result = parseResponse<ApiResponse<T>>(response.data);
  if (!result.ok) throw new Error(result.error || `${action} failed`);
  return result.data as T;
}

async function post<T = unknown>(action: string, body: unknown): Promise<T> {
  const response = await withRetry(() =>
    client.post('', JSON.stringify(body), { params: { action } }),
  );
  const result = parseResponse<ApiResponse<T>>(response.data);
  if (!result.ok) throw new Error(result.error || `${action} failed`);
  return result.data as T;
}

export const sheetsApi = {
  async getCards(): Promise<CardRecord[]> {
    const data = await get<CardRecord[]>(API_ACTIONS.GET_CARDS);
    return data || [];
  },

  async getCardsList(): Promise<Array<{ card_id: string; title: string; is_active: boolean }>> {
    const data = await get<Array<{ card_id: string; title: string; is_active: boolean }>>(
      API_ACTIONS.GET_CARDS_LIST,
    );
    return data || [];
  },

  async getCard(cardId: string): Promise<CardRecord | null> {
    return get<CardRecord | null>(API_ACTIONS.GET_CARD, { id: cardId });
  },

  async checkUser(vkId: string, name?: string): Promise<UserRecord> {
    return get<UserRecord>(API_ACTIONS.CHECK_USER, {
      vk_id: vkId,
      name: name || '',
    });
  },

  async saveUser(user: UserRecord): Promise<void> {
    await post(API_ACTIONS.SAVE_USER, user);
  },

  async saveAnswer(answer: AnswerRecord & { log?: LogRecord[] }): Promise<void> {
    await post(API_ACTIONS.SAVE_ANSWER, answer);
  },

  async saveFeedback(feedback: {
    card_id: string;
    name: string;
    message: string;
    vk_id: string;
    log?: LogRecord[];
  }): Promise<void> {
    await post('saveFeedback', feedback);
  },

  /**
   * Ручная отправка лога из админки (кнопка "Отправить лог").
   * Пишет одну строку в лист Logs с vk_id="admin" на стороне Apps Script.
   */
  async saveManualLog(log: LogRecord[]): Promise<{ saved: boolean; count: number }> {
    return post<{ saved: boolean; count: number }>(API_ACTIONS.SAVE_MANUAL_LOG, { log });
  },

  async getStats(): Promise<CardStat[]> {
    const data = await get<CardStat[]>(API_ACTIONS.GET_STATS);
    return data || [];
  },

  async saveCard(card: CardRecord): Promise<void> {
    await post(API_ACTIONS.SAVE_CARD, card);
  },

  async checkRepost(vkId: string, postId: string): Promise<boolean> {
    return get<boolean>(API_ACTIONS.CHECK_REPOST, {
      vk_id: vkId,
      post_id: postId,
    });
  },

  async getServerTime(): Promise<string> {
    const data = await get<{ iso: string }>(API_ACTIONS.GET_SERVER_TIME);
    return data?.iso || new Date().toISOString();
  },

  async syncOffline(answers: AnswerRecord[]): Promise<number> {
    const data = await post<{ saved: number }>(API_ACTIONS.SYNC_OFFLINE, { answers });
    return data?.saved || 0;
  },
};