/**
 * lib/sheets/logger.ts — логирование событий в буфере.
 *
 * Логи копятся в памяти и отправляются только вместе с ответом или фидбэком.
 *
 * logEvent синхронна (статический импорт стора): событие попадает в буфер
 * немедленно и гарантированно присутствует в снапшоте при последующем
 * getLogBuffer() — даже если отправка происходит в том же обработчике.
 */

import { useUserStore } from '@/lib/store/userStore';
import type { EventType } from '@/types';

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
export function logEvent(eventType: EventType, eventData: Record<string, unknown>) {
  const vkUser = useUserStore.getState().vkUser;
  logBuffer.push({
    timestamp: new Date().toISOString(),
    vk_id: vkUser?.id || 'anonymous',
    event_type: eventType,
    event_data: JSON.stringify(eventData),
    page_url: window.location.href,
    user_agent: navigator.userAgent,
  });
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
