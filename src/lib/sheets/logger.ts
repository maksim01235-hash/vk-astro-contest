/**
 * src/lib/sheets/logger.ts — клиентский логгер событий.
 *
 * Логи копятся только в памяти текущей страницы. Самостоятельных HTTP-запросов
 * этот модуль не делает: накопленный лог передаётся вместе с saveAnswer или
 * saveFeedback, затем очищается только после успешной отправки.
 */

import type { EventType, LogRecord } from '@/types';
import { nowISO } from '@/utils/time';
import { safeStringify } from '@/utils/json';
import { useUserStore } from '@/lib/store/userStore';

let buffer: LogRecord[] = [];

function buildRecord(
  eventType: EventType,
  eventData: Record<string, unknown>,
): LogRecord {
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

/** Добавить событие в память, не выполняя сетевой запрос. */
export async function logEvent(
  eventType: EventType,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  try {
    buffer.push(buildRecord(eventType, eventData));
  } catch (error) {
    console.warn('[logger] logEvent failed:', eventType, error);
  }
}

/** Получить снимок накопленного лога для включения в запрос. */
export function getLogBuffer(): LogRecord[] {
  return [...buffer];
}

/** Очистить накопленный лог после успешного saveAnswer/saveFeedback. */
export function clearLogBuffer(): void {
  buffer = [];
}
