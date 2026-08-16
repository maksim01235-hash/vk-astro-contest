/**
 * lib/sheets/logger.ts — клиентский логгер событий.
 * Логирует в таблицу Logs через Apps Script (saveLog).
 *
 * Зачем: единая точка логирования всех ключевых событий (клики, переходы,
 * ошибки, DnD) для дебага и аналитики.
 *
 * Важно: логи отправляются "best-effort" (fire-and-forget) — не блокируют UI.
 * При ошибке логирования пишем в console, чтобы не зацикливаться.
 */

import type { EventType, LogRecord } from '@/types';
import { nowISO } from '@/utils/time';
import { safeStringify } from '@/utils/json';
import { useUserStore } from '@/lib/store/userStore';

/**
 * Логирует событие в таблицу Logs (через sheetsApi.saveLog).
 * Не бросает исключения — логирование не должно ломать UX.
 *
 * @param eventType — тип события (см. EventType)
 * @param eventData — данные события (любой объект)
 */
export async function logEvent(
  eventType: EventType,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  try {
    const vkUser = useUserStore.getState().vkUser;
    const log: LogRecord = {
      timestamp: nowISO(),
      vk_id: vkUser?.id || 'anonymous',
      event_type: eventType,
      event_data: safeStringify(eventData),
      page_url: typeof window !== 'undefined' ? window.location.href : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    // Динамический импорт sheetsApi, чтобы избежать циклических зависимостей.
    const { sheetsApi } = await import('./api.client');
    await sheetsApi.saveLog(log);
  } catch (e) {
    // Логирование не должно ломать приложение.
    console.warn('[logger] logEvent failed:', eventType, e);
  }
}
