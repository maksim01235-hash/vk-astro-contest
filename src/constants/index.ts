/**
 * src/constants/index.ts — все константы приложения.
 *
 * Обновления (август 2026, сервер-как-источник-истины):
 *  - Префикс localStorage с версией схемы (v2): при несовместимых изменениях
 *    ключей старые данные гарантированно не читаются новой логикой.
 *  - Кеш списка карточек сокращён до 2 минут.
 *  - Удалены локальные ключи репоста, уведомлений и флага «ответил»:
 *    эти данные живут в Google Sheets (Answers / Users).
 *  - Новый экшен MARK_CARD_OPEN — время первого просмотра карточки (лист Opens).
 */

export const SHEETS_API_URL =
  process.env.NEXT_PUBLIC_SHEETS_API_URL || '';

/** Серверный API настроен? Без него обращения к Sheets бессмысленны. */
export const HAS_SHEETS_API = SHEETS_API_URL.length > 0;

export const MOCK_MODE =
  process.env.NEXT_PUBLIC_MOCK_MODE === 'true' ||
  process.env.NEXT_PUBLIC_MOCK_MODE === '1';

export const REQUEST_TIMEOUT_MS = 15000;

export const RETRY_COUNT = 3;

export const RETRY_BASE_DELAY_MS = 1000;

/** Время жизни клиентского кеша списка карточек. */
export const CARDS_CACHE_TTL_MS = 2 * 60 * 1000;

/**
 * Версия схемы локального хранилища. При изменении формата ключей
 * поднимите версию — migrateLegacyStorage() удалит ключи прошлых версий.
 */
export const STORAGE_SCHEMA_VERSION = 'v2';

export const STORAGE_PREFIX = `vk_contest_${STORAGE_SCHEMA_VERSION}_`;

/** Префикс ключей всех предыдущих версий хранилища (для одноразовой чистки). */
export const LEGACY_STORAGE_PREFIX = 'vk_contest_';

export const STORAGE_CARDS_KEY = `${STORAGE_PREFIX}cards_cache`;

/**
 * Fallback времени первого открытия карточки. Используется ТОЛЬКО когда
 * сервер недоступен; основное значение приходит из листа Opens (markCardOpen).
 */
export const STORAGE_OPEN_TIME_PREFIX = `${STORAGE_PREFIX}card_open_`;

export const STORAGE_VK_USER_KEY = `${STORAGE_PREFIX}vk_user`;

export const STORAGE_OFFLINE_QUEUE = `${STORAGE_PREFIX}offline_answers`;

/** Пользователь закрыл попап уведомлений («Не сейчас») — больше не показываем. */
export const STORAGE_NOTIF_DISMISSED = `${STORAGE_PREFIX}notif_dismissed`;

export const ADMIN_PASSWORD_HASH =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH || '';

export const STORAGE_ADMIN_AUTH = `${STORAGE_PREFIX}admin_authed`;

export const VK_APP_ID = process.env.NEXT_PUBLIC_VK_APP_ID || '';

export const API_ACTIONS = {
  GET_CARDS: 'getCards',
  GET_CARDS_LIST: 'getCardsList',
  GET_CARD: 'getCard',
  SAVE_ANSWER: 'saveAnswer',
  SAVE_FEEDBACK: 'saveFeedback',
  CHECK_USER: 'checkUser',
  GET_ANSWERED_CARDS: 'getAnsweredCards',
  HAS_ANSWERED: 'hasAnswered',
  SAVE_USER: 'saveUser',
  GET_STATS: 'getStats',
  SAVE_CARD: 'saveCard',
  CHECK_REPOST: 'checkRepost',
  GET_SERVER_TIME: 'getServerTime',
  SYNC_OFFLINE: 'syncOffline',
  SAVE_MANUAL_LOG: 'saveManualLog',
  MARK_CARD_OPEN: 'markCardOpen',
  REFRESH_REPOSTS: 'refreshReposts',
} as const;

export type ApiAction = (typeof API_ACTIONS)[keyof typeof API_ACTIONS];

export const ACCENT_COLOR = '#3B82F6';
