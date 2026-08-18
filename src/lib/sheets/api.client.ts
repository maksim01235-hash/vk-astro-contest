/**
 * lib/sheets/api.client.ts — клиент Google Apps Script REST API.
 *
 * Обновления (август 2026):
 *  - Добавлен метод getCardsList() для лёгкого списка карточек.
 *  - saveAnswer/saveFeedback принимают log (массив LogRecord) и передают его на сервер.
 *  - Удалены saveLog/saveLogsBatch как отдельные методы (логи теперь отправляются только вместе с ответом/фидбэком).
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  SHEETS_API_URL,
  REQUEST_TIMEOUT_MS,
  RETRY_COUNT,
  RETRY_BASE_DELAY_MS,
  API_ACTIONS,
} from '@/constants';
import type {
  CardRecord,
  UserRecord,
  AnswerRecord,
  LogRecord,
  CardStat,
  ApiResponse,
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
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isNetwork = e instanceof AxiosError && !e.response;
      const is5xx = e instanceof AxiosError && !!e.response && e.response.status >= 500;
      if (!isNetwork && !is5xx) throw e;
      if (attempt < RETRY_COUNT - 1) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}

function parseResponse<T>(raw: unknown): T {
  if (typeof raw === 'string') return JSON.parse(raw) as T;
  return raw as T;
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
    const response = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_CARDS } }),
    );
    const result = parseResponse<ApiResponse<CardRecord[]>>(response.data);
    if (!result.ok) throw new Error(result.error || 'getCards failed');
    return result.data || [];
  },

  /**
   * Новый метод: лёгкий список карточек (card_id, title, is_active).
   * Используется в админке для селектора карточек.
   */
  async getCardsList(): Promise<Array<{ card_id: string; title: string; is_active: boolean }>> {
    const response = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_CARDS_LIST } }),
    );
    const result = parseResponse<ApiResponse<Array<{ card_id: string; title: string; is_active: boolean }>>>(response.data);
    if (!result.ok) throw new Error(result.error || 'getCardsList failed');
    return result.data || [];
  },

  async getCard(cardId: string): Promise<CardRecord | null> {
    const response = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_CARD, id: cardId } }),
    );
    const result = parseResponse<ApiResponse<CardRecord>>(response.data);
    if (!result.ok) throw new Error(result.error || 'getCard failed');
    return result.data || null;
  },

  async checkUser(vkId: string, name?: string): Promise<UserRecord> {
    const response = await withRetry(() =>
      client.get('', {
        params: { action: API_ACTIONS.CHECK_USER, vk_id: vkId, name: name || '' },
      }),
    );
    const result = parseResponse<ApiResponse<UserRecord>>(response.data);
    if (!result.ok) throw new Error(result.error || 'checkUser failed');
    return result.data as UserRecord;
  },

  async saveUser(user: UserRecord): Promise<void> {
    await post(API_ACTIONS.SAVE_USER, user);
  },

  /**
   * Сохранение ответа пользователя.
   * @param answer — объект ответа, включая log (массив LogRecord, опционально).
   */
  async saveAnswer(answer: AnswerRecord & { log?: LogRecord[] }): Promise<void> {
    await post(API_ACTIONS.SAVE_ANSWER, answer);
  },

  /**
   * Сохранение обратной связи.
   * @param feedback — объект фидбэка, включая log (массив LogRecord, опционально).
   */
  async saveFeedback(feedback: {
    card_id: string;
    name: string;
    message: string;
    vk_id: string;
    log?: LogRecord[];
  }): Promise<void> {
    await post('saveFeedback', feedback);
  },

  async getStats(): Promise<CardStat[]> {
    const response = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_STATS } }),
    );
    const result = parseResponse<ApiResponse<CardStat[]>>(response.data);
    if (!result.ok) throw new Error(result.error || 'getStats failed');
    return result.data || [];
  },

  async saveCard(card: CardRecord): Promise<void> {
    await post(API_ACTIONS.SAVE_CARD, card);
  },

  async checkRepost(vkId: string, postId: string): Promise<boolean> {
    const response = await withRetry(() =>
      client.get('', {
        params: { action: API_ACTIONS.CHECK_REPOST, vk_id: vkId, post_id: postId },
      }),
    );
    const result = parseResponse<ApiResponse<boolean>>(response.data);
    if (!result.ok) throw new Error(result.error || 'checkRepost failed');
    return result.data === true;
  },

  async getServerTime(): Promise<string> {
    const response = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_SERVER_TIME } }),
    );
    const result = parseResponse<ApiResponse<{ iso: string }>>(response.data);
    if (!result.ok) throw new Error(result.error || 'getServerTime failed');
    return result.data?.iso || new Date().toISOString();
  },

  async syncOffline(answers: AnswerRecord[]): Promise<number> {
    const result = await post<{ saved: number }>(API_ACTIONS.SYNC_OFFLINE, { answers });
    return result?.saved || 0;
  },
};