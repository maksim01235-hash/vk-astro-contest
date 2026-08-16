/**
 * types/index.ts — глобальные TypeScript-интерфейсы для всего приложения.
 * Здесь описаны все структуры данных: пользователь, карточка, ответ, лог,
 * блоки карточки (JSON-схема конструктора), состояние DnD.
 */

// ============================================================
// ПОЛЬЗОВАТЕЛЬ
// ============================================================

/** Пользователь из VK Bridge (VKWebAppGetUserInfo). */
export interface VKUserInfo {
  /** VK ID пользователя (число как строка). */
  id: string;
  /** Имя (first_name). */
  first_name: string;
  /** Фамилия (last_name). */
  last_name: string;
  /** Полное имя (склейка first + last). */
  name?: string;
  /** URL аватара. */
  photo_200?: string;
  /** Пол (0 — не указан, 1 — женский, 2 — мужской). */
  sex?: number;
}

/** Запись в таблице Users (Google Sheets). */
export interface UserRecord {
  vk_id: string;
  name: string;
  reg_date: string; // ISO-строка
  subscribed: boolean;
  last_activity: string; // ISO-строка
}

// ============================================================
// КАРТОЧКИ КОНКУРСА
// ============================================================

/** Карточка конкурса — запись в таблице Cards. */
export interface CardRecord {
  /** Уникальный ID карточки (число или строка). */
  card_id: string;
  /** Заголовок карточки. */
  title: string;
  /** Дата/время публикации (ISO-строка). До этого времени карточка недоступна. */
  release_datetime: string;
  /** ID поста на стене (для проверки репоста). */
  post_id: string;
  /** JSON-схема блоков карточки (строка из Sheets или распарсенный объект). */
  json_schema: string;
  /** Активна ли карточка (false = скрыта). */
  is_active: boolean;
}

/** Статус карточки для пользователя. */
export type CardStatus = 'locked' | 'available' | 'completed';

/** Карточка с вычисленным статусом для отображения в списке. */
export interface CardWithStatus extends CardRecord {
  status: CardStatus;
  /** delta_seconds, если ответ отправлен. */
  delta_seconds?: number;
}

// ============================================================
// БЛОКИ КАРТОЧКИ (JSON-СХЕМА КОНСТРУКТОРА)
// ============================================================

/** Типы блоков в конструкторе карточек. */
export type BlockType =
  | 'TextBlock'
  | 'ImageBlock'
  | 'InputField'
  | 'Button'
  | 'DragZone'
  | 'DragObject';

/** Базовые поля для любого блока. */
export interface BaseBlock {
  /** Уникальный ID блока (генерируется в конструкторе). */
  id: string;
  /** Тип блока. */
  type: BlockType;
  /** Порядок в карточке (индекс). */
  order: number;
}

/** Текстовый блок (Markdown). */
export interface TextBlock extends BaseBlock {
  type: 'TextBlock';
  /** Markdown-текст условия. */
  content: string;
}

/** Картинка. */
export interface ImageBlock extends BaseBlock {
  type: 'ImageBlock';
  /** URL изображения. */
  src: string;
  /** Alt-текст. */
  alt?: string;
  /** Ширина в px или 'full'. */
  width?: number | 'full';
}

/** Поле ввода ответа. */
export interface InputFieldBlock extends BaseBlock {
  type: 'InputField';
  /** Подпись поля. */
  label: string;
  /** Placeholder. */
  placeholder?: string;
  /** Тип ввода: text, number, email. */
  inputType?: 'text' | 'number' | 'email';
  /** Обязательное ли поле. */
  required?: boolean;
  /** Ключ в user_answer, под которым сохранится значение. */
  answerKey: string;
}

/** Кнопка (обычно "Отправить ответ"). */
export interface ButtonBlock extends BaseBlock {
  type: 'Button';
  /** Текст кнопки. */
  label: string;
  /** Действие: submit — отправить ответ. */
  action: 'submit' | 'repost' | 'custom';
  /** Стиль кнопки. */
  variant?: 'primary' | 'secondary' | 'danger';
}

/** Зона для перетаскивания (корзина/слот). */
export interface DragZoneBlock extends BaseBlock {
  type: 'DragZone';
  /** ID зоны (для сопоставления с allowedZones в DragObject). */
  zoneId: string;
  /** Отображаемое название зоны. */
  label: string;
  /** Сколько объектов можно положить (0 = без лимита). */
  maxItems?: number;
}

/** Объект для перетаскивания. */
export interface DragObjectBlock extends BaseBlock {
  type: 'DragObject';
  /** ID объекта. */
  objectId: string;
  /** Отображаемый текст объекта. */
  label: string;
  /** ID зон, в которые можно перетащить этот объект. */
  allowedZones: string[];
  /** Картинка объекта (опционально). */
  image?: string;
}

/** Объединённый тип блока. */
export type Block =
  | TextBlock
  | ImageBlock
  | InputFieldBlock
  | ButtonBlock
  | DragZoneBlock
  | DragObjectBlock;

/** JSON-схема карточки — массив блоков. */
export interface CardSchema {
  blocks: Block[];
}

// ============================================================
// ОТВЕТЫ И ЛОГИ
// ============================================================

/** Ответ пользователя — запись в таблице Answers. */
export interface AnswerRecord {
  id: string;
  vk_id: string;
  card_id: string;
  open_timestamp: string; // ISO
  submit_timestamp: string; // ISO
  delta_seconds: number;
  /** JSON-строка с ответами пользователя. */
  user_answer: string;
  has_reposted: boolean;
}

/** Состояние DnD в user_answer: { zoneId: [objectId, ...] }. */
export type DnDState = Record<string, string[]>;

/** Данные ответа, собираемые с карточки при отправке. */
export interface AnswerPayload {
  /** Значения полей ввода: { answerKey: value }. */
  inputs: Record<string, string>;
  /** Состояние DnD: { zoneId: [objectId, ...] }. */
  dnd: DnDState;
}

/** Запись лога — таблица Logs. */
export interface LogRecord {
  timestamp: string; // ISO
  vk_id: string;
  event_type: string;
  /** JSON-строка с данными события. */
  event_data: string;
  page_url: string;
  user_agent: string;
}

// ============================================================
// API
// ============================================================

/** Стандартный ответ Apps Script API. */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Статистика по карточке для /admin/stats. */
export interface CardStat {
  card_id: string;
  title: string;
  total_answers: number;
  total_users: number;
  pct_answered: number;
  avg_delta: number;
  min_delta: number;
  max_delta: number;
  reposted_count: number;
}

/** Типы событий для логирования. */
export type EventType =
  | 'card_open'
  | 'card_submit'
  | 'api_error'
  | 'dnd_change'
  | 'repost_click'
  | 'repost_success'
  | 'repost_fail'
  | 'modal_open'
  | 'modal_close'
  | 'auth_success'
  | 'auth_fail'
  | 'notification_request'
  | 'notification_granted'
  | 'notification_denied'
  | 'offline_save'
  | 'offline_sync'
  | 'admin_save_card'
  | 'admin_login'
  | string; // расширяемый
