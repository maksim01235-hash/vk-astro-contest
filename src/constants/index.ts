/**
 * constants/index.ts — все константы приложения.
 * URL, таймауты, TTL, ключи localStorage, хеш пароля админки, эндпоинты.
 * Каждая снабжена комментарием "что это" и "зачем".
 */

// ============================================================
// API (Google Apps Script)
// ============================================================

/**
 * URL опубликованного Apps Script веб-приложения.
 * Берётся из NEXT_PUBLIC_SHEETS_API_URL (задаётся в .env.local).
 * В mock-режиме не используется.
 */
export const SHEETS_API_URL =
  process.env.NEXT_PUBLIC_SHEETS_API_URL || '';

/**
 * Режим mock: если true — VK Bridge не вызывается, API отдаёт тестовые данные.
 * Удобно для локальной разработки и preview без VK.
 */
export const MOCK_MODE =
  process.env.NEXT_PUBLIC_MOCK_MODE === 'true' ||
  process.env.NEXT_PUBLIC_MOCK_MODE === '1';

/** Таймаут одного HTTP-запроса к Apps Script (мс). */
export const REQUEST_TIMEOUT_MS = 15000;

/** Количество ретраев при ошибке запроса. */
export const RETRY_COUNT = 3;

/** Базовая задержка между ретраями (мс, экспоненциальная: delay * 2^attempt). */
export const RETRY_BASE_DELAY_MS = 1000;

// ============================================================
// КЕШИРОВАНИЕ (localStorage с TTL)
// ============================================================

/** TTL кеша карточек: 5 минут (мс). */
export const CARDS_CACHE_TTL_MS = 5 * 60 * 1000;

/** TTL кеша репоста: 1 час (мс). */
export const REPOST_CACHE_TTL_MS = 60 * 60 * 1000;

// ============================================================
// КЛЮЧИ localStorage
// ============================================================

/** Префикс для всех ключей приложения (чтобы не конфликтовать с другими). */
export const STORAGE_PREFIX = 'vk_contest_';

/** Ключ кеша списка карточек. */
export const STORAGE_CARDS_KEY = `${STORAGE_PREFIX}cards_cache`;

/** Ключ времени открытия карточки: card_${id}_open. */
export const STORAGE_OPEN_TIME_PREFIX = `${STORAGE_PREFIX}card_`;

/** Ключ кеша статуса репоста по карточке: repost_${card_id}. */
export const STORAGE_REPOST_PREFIX = `${STORAGE_PREFIX}repost_`;

/** Ключ VK ID пользователя (после авторизации). */
export const STORAGE_VK_USER_KEY = `${STORAGE_PREFIX}vk_user`;

/** Ключ флага "уведомления запрошены". */
export const STORAGE_NOTIF_REQUESTED = `${STORAGE_PREFIX}notif_requested`;

/** Ключ очереди ответов для оффлайн-отправки. */
export const STORAGE_OFFLINE_QUEUE = `${STORAGE_PREFIX}offline_answers`;

/** Ключ флага первого захода (для попапа уведомлений). */
export const STORAGE_FIRST_VISIT = `${STORAGE_PREFIX}first_visit`;

// ============================================================
// АДМИН-ПАНЕЛЬ
// ============================================================

/**
 * SHA-256-хеш пароля админки.
 * Берётся из NEXT_PUBLIC_ADMIN_PASSWORD_HASH.
 * Сгенерировать: см. README → "Настройка админки".
 * ВАЖНО: это защита от случайного доступа, НЕ криптографическая.
 * Любой может прочитать хеш в собранном коде и вызвать Apps Script напрямую.
 */
export const ADMIN_PASSWORD_HASH =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH || '';

/** Ключ sessionStorage для хранения факта входа в админку (на сессию). */
export const STORAGE_ADMIN_AUTH = `${STORAGE_PREFIX}admin_authed`;

// ============================================================
// VK
// ============================================================

/** ID приложения VK (из NEXT_PUBLIC_VK_APP_ID). */
export const VK_APP_ID = process.env.NEXT_PUBLIC_VK_APP_ID || '';

// ============================================================
// ЭНДПОИНТЫ APPS SCRIPT (action-параметры)
// ============================================================

/** Все действия, которые фронт отправляет на Apps Script. */
export const API_ACTIONS = {
  GET_CARDS: 'getCards',
  GET_CARD: 'getCard',
  SAVE_ANSWER: 'saveAnswer',
  CHECK_USER: 'checkUser',
  SAVE_USER: 'saveUser',
  SAVE_LOG: 'saveLog',
  GET_STATS: 'getStats',
  SAVE_CARD: 'saveCard', // админка: сохранить карточку
  CHECK_REPOST: 'checkRepost', // проверка репоста через VK API
  GET_SERVER_TIME: 'getServerTime', // серверное время (для сравнения release)
  SYNC_OFFLINE: 'syncOffline', // пакетная отправка оффлайн-очереди
} as const;

export type ApiAction = (typeof API_ACTIONS)[keyof typeof API_ACTIONS];

// ============================================================
// ДЕКОР И UI
// ============================================================

/** Акцентный синий цвет (используется в Tailwind как accent). */
export const ACCENT_COLOR = '#3B82F6';
