/**
 * lib/sheets/logger.ts — логирование событий в буфере.
 *
 * Логи копятся в памяти и отправляются только вместе с ответом или фидбэком.
 */

import type { EventType, LogRecord } from '@/types';

interface LogEntry {
  timestamp: string;
  vk_id: string;
  event_type: EventType;
  event_data: string;
  page_url: string;
  user_agent: string;
}

let logBuffer: LogEntry[] = [];

/**
 * Добавить событие в буфер логов.
 */
export async function logEvent(eventType: EventType, eventData: Record<string, unknown>) {
  const vkUser = await import('@/lib/store/userStore').then((m) => m.useUserStore.getState().vkUser);
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    vk_id: vkUser?.id || 'anonymous',
    event_type: eventType,
    event_data: JSON.stringify(eventData),
    page_url: window.location.href,
    user_agent: navigator.userAgent,
  };
  logBuffer.push(entry);
}

/**
 * Получить буфер логов (для отправки вместе с ответом).
 */
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

/**
 * Очистить буфер логов (после успешной отправки).
 */
export function clearLogBuffer() {
  logBuffer = [];
}