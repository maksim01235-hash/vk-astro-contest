/**
 * lib/sheets/logger.ts — логирование событий в буфере.
 *
 * Логи копятся в памяти и отправляются только вместе с ответом или фидбэком.
 *
 * Обновление (август 2026): жёсткий лимит размера буфера. Раньше события
 * вроде marker_move могли раздуть payload saveAnswer до десятков КБ, что на
 * слабой сети приводило к таймаутам и «пропадающим» логам. При переполнении
 * самые старые события отбрасываются — свежая диагностика важнее полной истории.
 */

import type { EventType, LogRecord } from '@/types';

/** Максимум событий в буфере (одна отправка не тяжелее ~50–70 КБ). */
const MAX_LOG_BUFFER = 200;

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

  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_BUFFER);
  }
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