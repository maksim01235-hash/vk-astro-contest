/**
 * lib/sheets/logger.ts — логирование событий в буфере.
 *
 * Логи копятся в памяти и отправляются вместе с ответом или фидбэком.
 *
 * Обновления (август 2026):
 *  - Жёсткий лимит буфера MAX_LOG_BUFFER. Раньше события вроде marker_move
 *    могли раздуть payload saveAnswer до десятков КБ, что на слабой сети
 *    приводило к таймаутам и «пропадающим» логам.
 *  - Автосброс: достижение лимита триггерит автоматическую отправку буфера
 *    отдельным запросом (saveManualLog от имени пользователя). При сбое
 *    буфер сохраняется — повтор на следующем событии.
 *  - logEvent синхронна (статический импорт стора): событие попадает в буфер
 *    немедленно и гарантированно присутствует в снапшоте при последующем
 *    getLogBuffer() — даже если отправка происходит в том же обработчике.
 */

import { useUserStore } from '@/lib/store/userStore';
import type { EventType } from '@/types';

/**
 * Максимум событий в буфере: жёсткий потолок размера и порог автосброса.
 * Одна отправка остаётся в пределах ~50–70 КБ даже на слабой сети.
 */
export const MAX_LOG_BUFFER = 200;

interface LogEntry {
  timestamp: string;
  vk_id: string;
  event_type: EventType;
  event_data: string;
  page_url: string;
  user_agent: string;
}

let logBuffer: LogEntry[] = [];

/** Защита от параллельных автосбросов. */
let flushing = false;

/**
 * Добавить событие в буфер логов.
 * При достижении MAX_LOG_BUFFER запускает автоматическую отправку.
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

  // Страховка: если автосброс не удался много раз подряд, не даём буферу
  // расти бесконечно — свежая диагностика важнее полной истории.
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_BUFFER);
  }

  if (logBuffer.length >= MAX_LOG_BUFFER) {
    scheduleAutoFlush();
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

/**
 * Автоматическая отправка переполненного буфера отдельным запросом.
 * Успех — отправленные события удаляются из буфера; сбой — остаются,
 * попытка повторится на следующем событии.
 */
async function flushOverflow(): Promise<void> {
  if (flushing) return;

  flushing = true;
  const snapshot = getLogBuffer().slice(0, MAX_LOG_BUFFER);

  try {
    // Динамический импорт: исключает циклическую зависимость модулей.
    const { sheetsApi } = await import('@/lib/sheets/api.client');
    await sheetsApi.saveManualLog(snapshot, useUserStore.getState().vkUser?.id);
    logBuffer.splice(0, snapshot.length);
  } catch (error) {
    console.warn('[logger] автоотправка лога не удалась:', error);
  } finally {
    flushing = false;
  }
}

function scheduleAutoFlush(): void {
  void flushOverflow();
}
