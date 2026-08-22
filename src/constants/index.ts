/**
 * src/constants/index.ts — все константы приложения.
 *
 * Обновления (август 2026):
 *  - Добавлены константы для ImageMarkerBlock.
 */

export const SHEETS_API_URL =
  process.env.NEXT_PUBLIC_SHEETS_API_URL || '';

export const MOCK_MODE =
  process.env.NEXT_PUBLIC_MOCK_MODE === 'true' ||
  process.env.NEXT_PUBLIC_MOCK_MODE === '1';

export const REQUEST_TIMEOUT_MS = 15000;

export const RETRY_COUNT = 3;

export const RETRY_BASE_DELAY_MS = 1000;

export const CARDS_CACHE_TTL_MS = 5 * 60 * 1000;

export const REPOST_CACHE_TTL_MS = 60 * 60 * 1000;

export const STORAGE_PREFIX = 'vk_contest_';

export const STORAGE_CARDS_KEY = `${STORAGE_PREFIX}cards_cache`;

export const STORAGE_OPEN_TIME_PREFIX = `${STORAGE_PREFIX}card_`;

export const STORAGE_REPOST_PREFIX = `${STORAGE_PREFIX}repost_`;

export const STORAGE_VK_USER_KEY = `${STORAGE_PREFIX}vk_user`;

export const STORAGE_NOTIF_REQUESTED = `${STORAGE_PREFIX}notif_requested`;

export const STORAGE_OFFLINE_QUEUE = `${STORAGE_PREFIX}offline_answers`;

export const STORAGE_FIRST_VISIT = `${STORAGE_PREFIX}first_visit`;

export const ADMIN_PASSWORD_HASH =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH || '';

export const STORAGE_ADMIN_AUTH = `${STORAGE_PREFIX}admin_authed`;

export const VK_APP_ID = process.env.NEXT_PUBLIC_VK_APP_ID || '';

export const API_ACTIONS = {
  GET_CARDS: 'getCards',
  GET_CARDS_LIST: 'getCardsList',
  GET_CARD: 'getCard',
  SAVE_ANSWER: 'saveAnswer',
  CHECK_USER: 'checkUser',
  SAVE_USER: 'saveUser',
  GET_STATS: 'getStats',
  SAVE_CARD: 'saveCard',
  CHECK_REPOST: 'checkRepost',
  GET_SERVER_TIME: 'getServerTime',
  SYNC_OFFLINE: 'syncOffline',
  SAVE_MANUAL_LOG: 'saveManualLog',
} as const;

export type ApiAction = (typeof API_ACTIONS)[keyof typeof API_ACTIONS];

export const ACCENT_COLOR = '#3B82F6';

/** Константы для ImageMarkerBlock. */
export const DEFAULT_MARKER_COLOR = '#3B82F6';

export const DEFAULT_MARKER_SIZE_PERCENT = 5;