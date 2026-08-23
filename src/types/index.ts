/**
 * types/index.ts — глобальные TypeScript-интерфейсы для всего приложения.
 *
 * Обновления (v5, август 2026):
 *  - ImageBlock: images[], layoutMode, gridColumns для сетки изображений.
 *  - DnD: LayoutMode, layoutMode, gridColumns для зон и объектов.
 *  - ImageMarkerBlock: новый блок с меткой на изображении.
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

export type BlockType =
  | 'TextBlock'
  | 'ImageBlock'
  | 'InputField'
  | 'Button'
  | 'DragZone'
  | 'DragObject'
  | 'ImageMarkerBlock';

export interface BaseBlock {
  id: string;
  type: BlockType;
  order: number;
}

export interface TextBlock extends BaseBlock {
  type: 'TextBlock';
  content: string;
}

export interface ImageItem {
  id: string;
  src: string;
  alt?: string;
}

/** Режим раскладки изображений и DnD-объектов. */
export type LayoutMode = 'auto' | 'grid';

export interface ImageBlock extends BaseBlock {
  type: 'ImageBlock';
  src?: string;
  alt?: string;
  width?: number | 'full';
  maxImageWidth?: number;
  maxImageHeight?: number;
  viewer?: boolean;
  images?: ImageItem[];
  layoutMode?: 'grid' | 'flex';
  gridColumns?: number;
}

export interface InputFieldBlock extends BaseBlock {
  type: 'InputField';
  label: string;
  placeholder?: string;
  inputType?: 'text' | 'number' | 'email';
  required?: boolean;
  answerKey: string;
  /** Правильный ответ. Автопроверка включается только для чисел (inputType: 'number'). */
  correctAnswer?: string;
  /** Допуск отклонения в процентах от правильного ответа (0 или пусто — точное совпадение). */
  tolerancePercent?: number;
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
  /** ID объектов, которые должны находиться в зоне для правильного ответа. */
  correctObjectIds?: string[];
  /** Автоматическая раскладка или сетка объектов в зоне. */
  layoutMode?: LayoutMode;
  /** Количество колонок для grid-режима. */
  gridColumns?: number;
}

export type TextPosition = 'left' | 'right' | 'top' | 'bottom';

export interface DragObjectBlock extends BaseBlock {
  type: 'DragObject';
  objectId: string;
  label?: string;
  textPosition?: TextPosition;
  allowedZones: string[];
  image?: string;
  maxImageSize?: number;
  imageSize?: number;
  /** Опциональный режим внутренней раскладки объекта. */
  layoutMode?: LayoutMode;
  /** Опциональное количество колонок для grid-режима. */
  gridColumns?: number;
}

export interface ImageMarkerBlock extends BaseBlock {
  type: 'ImageMarkerBlock';
  src: string;
  alt?: string;
  maxImageWidth?: number;
  maxImageHeight?: number;
  viewer?: boolean;
  correctX: number;
  correctY: number;
  errorPercent: number;
  markerColor?: string;
  markerSizePercent?: number;
  /** Режим перемещения метки: true — перетаскивается сразу, без клика-активации. */
  markerImmediateDrag?: boolean;
}

export type Block =
  | TextBlock
  | ImageBlock
  | InputFieldBlock
  | ButtonBlock
  | DragZoneBlock
  | DragObjectBlock
  | ImageMarkerBlock;

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
  /** Сырые координаты метки (0–100). Проверку выполняет Apps Script. */
  marker?: {
    userX: number;
    userY: number;
  };
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

export interface CardStat {
  card_id: string;
  title: string;
  total_answers: number;
  total_users: number;
  subscribed_count: number;
  subscribed_group_count: number;
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
  | 'marker_click'
  | 'marker_move'
  | 'marker_confirm'
  | string;
