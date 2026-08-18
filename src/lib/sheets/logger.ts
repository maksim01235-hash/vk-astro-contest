/**
 * lib/sheets/logger.ts — клиентский логгер событий.
 *
 * Обновления (август 2026):
 *  - Полная переработка: логи копятся только в памяти, без самостоятельной отправки.
 *  - Отправка лога происходит только вместе с saveAnswer/saveFeedback.
 *  - Функции getLogBuffer() и clearLogBuffer() для получения и сброса накопленного лога.
 *  - Старые batch-таймеры и flush удалены.
 */

import type { EventType, LogRecord } from '@/types';
import { nowISO } from '@/utils/time';
import { safeStringify } from '@/utils/json';
import { useUserStore } from '@/lib/store/userStore';

/**
 * Буфер логов в памяти.
 * Очищается после каждой отправки ответа/фидбэка.
 */
let buffer: LogRecord[] = [];

/** Собрать один LogRecord из типа события и данных. */
function buildRecord(eventType: EventType, eventData: Record<string, unknown>): LogRecord {
  const vkUser = useUserStore.getState().vkUser;
  return {
    timestamp: nowISO(),
    vk_id: vkUser?.id || 'anonymous',
    event_type: eventType,
    event_data: safeStringify(eventData),
    page_url: typeof window !== 'undefined' ? window.location.href : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

/**
 * Логирует событие — кладёт в буфер в памяти.
 * Реальная отправка происходит только вместе с saveAnswer/saveFeedback.
 *
 * @param eventType — тип события (см. EventType)
 * @param eventData — данные события (любой объект)
 */
export async function logEvent(
  eventType: EventType,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  try {
    buffer.push(buildRecord(eventType, eventData));
  } catch (e) {
    console.warn('[logger] logEvent failed:', eventType, e);
  }
}

/**
 * Получить текущий буфер логов (для отправки вместе с ответом/фидбэком).
 * @returns Копия массива LogRecord.
 */
export function getLogBuffer(): LogRecord[] {
  return [...buffer];
}

/**
 * Очистить буфер логов (после успешной отправки ответа/фидбэка).
 */
export function clearLogBuffer(): void {
  buffer = [];
}

/**
 * Принудительно добавить лог в буфер (для тестов или особых случаев).
 */
export function pushLog(record: LogRecord): void {
  buffer.push(record);
}