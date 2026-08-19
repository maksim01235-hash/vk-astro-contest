/**
 * types/index.ts — глобальные TypeScript-интерфейсы для всего приложения.
 *
 * Обновления (v3, август 2026):
 *  - ImageBlock: раздельные maxImageWidth/maxImageHeight, viewer (полноэкранный просмотр с зумом).
 *  - DragObjectBlock: label опционален, textPosition, maxImageSize/imageSize (накоплено из прошлых правок).
 *  - CardStat: subscribed_count (уведомления) + subscribed_group_count (подписка на группу VK).
 */

export interface VKUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  name?: string;
  photo_200?: string;
  sex?: number;
}

export interface UserRecord {
  vk_id: string;
  name: string;
  reg_date: string;
  subscribed: boolean;
  last_activity: string;
}

export interface CardRecord {
  card_id: string;
  title: string;
  release_datetime: string;
  post_id: string;
  json_schema: string;
  is_active: boolean;
}

export type CardStatus = 'locked' | 'available' | 'completed';

export interface CardWithStatus extends CardRecord {
  status: CardStatus;
  delta_seconds?: number;
}

export type BlockType = 'TextBlock' | 'ImageBlock' | 'InputField' | 'Button' | 'DragZone' | 'DragObject';

export interface BaseBlock {
  id: string;
  type: BlockType;
  order: number;
}

export interface TextBlock extends BaseBlock {
  type: 'TextBlock';
  content: string;
}

/** Картинка. */
export interface ImageBlock extends BaseBlock {
  type: 'ImageBlock';
  /** URL изображения. */
  src: string;
  /** Alt-текст (для screen-readers и fallback при ошибке загрузки). */
  alt?: string;
  /** Ширина в px или 'full'. */
  width?: number | 'full';
  /** Максимальная ширина картинки (px). Раздельно от высоты. */
  maxImageWidth?: number;
  /** Максимальная высота картинки (px). Раздельно от ширины. */
  maxImageHeight?: number;
  /** Показывать кнопку полноэкранного просмотра с зумом/панорамированием. */
  viewer?: boolean;
}

export interface InputFieldBlock extends BaseBlock {
  type: 'InputField';
  label: string;
  placeholder?: string;
  inputType?: 'text' | 'number' | 'email';
  required?: boolean;
  answerKey: string;
}

export interface ButtonBlock extends BaseBlock {
  type: 'Button';
  label: string;
  action: 'submit' | 'repost' | 'custom';
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface DragZoneBlock extends BaseBlock {
  type: 'DragZone';
  zoneId: string;
  label: string;
  maxItems?: number;
}

/** Положение текста относительно изображения в DragObject. */
export type TextPosition = 'left' | 'right' | 'top' | 'bottom';

/** Объект для перетаскивания. */
export interface DragObjectBlock extends BaseBlock {
  type: 'DragObject';
  objectId: string;
  /** Текст объекта (опционально — можно оставить только картинку). */
  label?: string;
  /** Положение текста относительно изображения. */
  textPosition?: TextPosition;
  allowedZones: string[];
  image?: string;
  /** Максимальный размер картинки для автоподстройки (px, квадратное ограничение). */
  maxImageSize?: number;
  /** Фиксированный размер картинки (px, приоритетнее maxImageSize). */
  imageSize?: number;
}

export type Block = TextBlock | ImageBlock | InputFieldBlock | ButtonBlock | DragZoneBlock | DragObjectBlock;

export interface CardSchema {
  blocks: Block[];
}

export interface AnswerRecord {
  id: string;
  vk_id: string;
  card_id: string;
  open_timestamp: string;
  submit_timestamp: string;
  delta_seconds: number;
  user_answer: string;
  has_reposted: boolean;
}

export type DnDState = Record<string, string[]>;

export interface AnswerPayload {
  inputs: Record<string, string>;
  dnd: DnDState;
}

export interface LogRecord {
  timestamp: string;
  vk_id: string;
  event_type: string;
  event_data: string;
  page_url: string;
  user_agent: string;
}

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
  /** Число подписавшихся на уведомления (VKWebAppAllowNotifications). */
  subscribed_count: number;
  /** Число участников конкурса, состоящих в группе VK (через groups.isMember). */
  subscribed_group_count: number;
  /** Процент уникальных пользователей, отправивших ответ (не общее число попыток). */
  pct_answered: number;
  avg_delta: number;
  min_delta: number;
  max_delta: number;
  reposted_count: number;
}

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
  | string;