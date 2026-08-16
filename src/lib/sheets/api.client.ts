/**
 * lib/sheets/api.client.ts — единый клиент для Google Apps Script REST API.
 *
 * Архитектура:
 *  - Apps Script публикуется как веб-приложение (URL = SHEETS_API_URL).
 *  - Все запросы идут через единый URL с параметром ?action=...
 *  - GET — для чтения (getCards, getCard, checkUser, getStats).
 *  - POST — для записи (saveAnswer, saveUser, saveLog, saveCard).
 *
 * Ретраи: axios-интерцептор с экспоненциальной задержкой (до RETRY_COUNT попыток).
 * При MOCK_MODE=true — отдаёт тестовые данные, не делает реальных запросов.
 *
 * ВАЖНО по CORS: Apps Script поддерживает ограниченные CORS-заголовки.
 * Мы используем простые запросы (Content-Type: text/plain для POST),
 * чтобы избежать preflight. Apps Script doGet/doPost читают тело как строку.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  SHEETS_API_URL,
  REQUEST_TIMEOUT_MS,
  RETRY_COUNT,
  RETRY_BASE_DELAY_MS,
  MOCK_MODE,
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
import { mockCards, mockStats } from './mockData';
/** Задержка для ретраев (экспоненциальная). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Создаём экземпляр axios с настройками. */
const client: AxiosInstance = axios.create({
  baseURL: SHEETS_API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  // text/plain — простой запрос, не вызывает CORS preflight.
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
});

/**
 * Выполняет запрос с ретраями (экспоненциальная задержка).
 * @param fn — функция, возвращающая Promise с запросом
 * @returns результат или бросает после RETRY_COUNT попыток
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isNetwork =
        e instanceof AxiosError && !e.response; // нет ответа = сеть/таймаут
      const is5xx =
        e instanceof AxiosError &&
        e.response &&
        e.response.status >= 500;
      // Ретрай только для сетевых и 5xx ошибок.
      if (!isNetwork && !is5xx) throw e;
      if (attempt < RETRY_COUNT - 1) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}

/**
 * Безопасно парсит ответ Apps Script.
 * Apps Script возвращает JSON в теле ContentService.
 */
function parseResponse<T>(raw: unknown): T {
  if (typeof raw === 'string') {
    return JSON.parse(raw) as T;
  }
  return raw as T;
}

// ============================================================
// ПУБЛИЧНЫЙ API
// ============================================================

export const sheetsApi = {
  /**
   * Получить все активные карточки.
   * GET ?action=getCards
   */
  async getCards(): Promise<CardRecord[]> {
    if (MOCK_MODE) return mockCards;
    const data = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_CARDS } }),
    );
    const res = parseResponse<ApiResponse<CardRecord[]>>(data.data);
    if (!res.ok) throw new Error(res.error || 'getCards failed');
    return res.data || [];
  },

  /**
   * Получить одну карточку по ID.
   * GET ?action=getCard&id=...
   */
  async getCard(cardId: string): Promise<CardRecord | null> {
    if (MOCK_MODE) {
      return mockCards.find((c) => c.card_id === cardId) || null;
    }
    const data = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_CARD, id: cardId } }),
    );
    const res = parseResponse<ApiResponse<CardRecord>>(data.data);
    if (!res.ok) throw new Error(res.error || 'getCard failed');
    return res.data || null;
  },

  /**
   * Проверить пользователя по VK ID. Если нового — автосоздание.
   * GET ?action=checkUser&vk_id=...&name=...
   */
  async checkUser(vkId: string, name?: string): Promise<UserRecord> {
    if (MOCK_MODE) {
      return {
        vk_id: vkId,
        name: name || 'Тестовый пользователь',
        reg_date: new Date().toISOString(),
        subscribed: false,
        last_activity: new Date().toISOString(),
      };
    }
    const data = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.CHECK_USER, vk_id: vkId, name: name || '' } }),
    );
    const res = parseResponse<ApiResponse<UserRecord>>(data.data);
    if (!res.ok) throw new Error(res.error || 'checkUser failed');
    return res.data as UserRecord;
  },

  /**
   * Сохранить/обновить пользователя (например, после подписки на уведомления).
   * POST ?action=saveUser
   */
  async saveUser(user: UserRecord): Promise<void> {
    if (MOCK_MODE) return;
    await withRetry(() =>
      client.post('', JSON.stringify(user), {
        params: { action: API_ACTIONS.SAVE_USER },
      }),
    );
  },

  /**
   * Сохранить ответ пользователя на карточку.
   * POST ?action=saveAnswer
   */
  async saveAnswer(answer: AnswerRecord): Promise<void> {
    if (MOCK_MODE) {
      console.log('[mock] saveAnswer:', answer);
      return;
    }
    await withRetry(() =>
      client.post('', JSON.stringify(answer), {
        params: { action: API_ACTIONS.SAVE_ANSWER },
      }),
    );
  },

  /**
   * Сохранить лог события (fire-and-forget, с ретраем).
   * POST ?action=saveLog
   */
  async saveLog(log: LogRecord): Promise<void> {
    if (MOCK_MODE) {
      console.log('[mock] saveLog:', log.event_type, log.event_data);
      return;
    }
    // Логи — fire-and-forget, но с ретраем для надёжности.
    await withRetry(() =>
      client.post('', JSON.stringify(log), {
        params: { action: API_ACTIONS.SAVE_LOG },
      }),
    );
  },

  /**
   * Получить статистику для админки.
   * GET ?action=getStats
   */
  async getStats(): Promise<CardStat[]> {
    if (MOCK_MODE) return mockStats;
    const data = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_STATS } }),
    );
    const res = parseResponse<ApiResponse<CardStat[]>>(data.data);
    if (!res.ok) throw new Error(res.error || 'getStats failed');
    return res.data || [];
  },

  /**
   * Сохранить карточку из админки.
   * POST ?action=saveCard
   */
  async saveCard(card: CardRecord): Promise<void> {
    if (MOCK_MODE) {
      console.log('[mock] saveCard:', card);
      return;
    }
    await withRetry(() =>
      client.post('', JSON.stringify(card), {
        params: { action: API_ACTIONS.SAVE_CARD },
      }),
    );
  },

  /**
   * Проверить репост через VK API (на стороне Apps Script).
   * GET ?action=checkRepost&vk_id=...&post_id=...
   * @returns true, если пользователь сделал репост.
   */
  async checkRepost(vkId: string, postId: string): Promise<boolean> {
    if (MOCK_MODE) return true;
    const data = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.CHECK_REPOST, vk_id: vkId, post_id: postId } }),
    );
    const res = parseResponse<ApiResponse<boolean>>(data.data);
    if (!res.ok) throw new Error(res.error || 'checkRepost failed');
    return res.data === true;
  },

  /**
   * Получить серверное время (ISO) для сравнения с release_datetime.
   * GET ?action=getServerTime
   */
  async getServerTime(): Promise<string> {
    if (MOCK_MODE) return new Date().toISOString();
    const data = await withRetry(() =>
      client.get('', { params: { action: API_ACTIONS.GET_SERVER_TIME } }),
    );
    const res = parseResponse<ApiResponse<{ iso: string }>>(data.data);
    if (!res.ok) throw new Error(res.error || 'getServerTime failed');
    return res.data?.iso || new Date().toISOString();
  },

  /**
   * Пакетная отправка оффлайн-очереди ответов.
   * POST ?action=syncOffline
   */
  async syncOffline(answers: AnswerRecord[]): Promise<number> {
    if (MOCK_MODE) {
      console.log('[mock] syncOffline:', answers.length, 'answers');
      return answers.length;
    }
    const data = await withRetry(() =>
      client.post('', JSON.stringify({ answers }), {
        params: { action: API_ACTIONS.SYNC_OFFLINE },
      }),
    );
    const res = parseResponse<ApiResponse<{ saved: number }>>(data.data);
    if (!res.ok) throw new Error(res.error || 'syncOffline failed');
    return res.data?.saved || 0;
  },
};
