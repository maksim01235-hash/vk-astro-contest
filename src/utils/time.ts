/**
 * utils/time.ts — хелперы для работы со временем.
 */

/**
 * Возвращает текущий timestamp в миллисекундах.
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Возвращает текущее время в ISO-строке.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Вычисляет delta в секундах между двумя timestamp (мс).
 * @param startMs — начало (мс)
 * @param endMs — конец (мс)
 * @returns секунды (округление до целого)
 */
export function deltaSeconds(startMs: number, endMs: number): number {
  return Math.round((endMs - startMs) / 1000);
}

/**
 * Проверяет, наступила ли дата release_datetime (сравнение с текущим временем).
 * @param releaseISO — ISO-строка даты публикации
 * @returns true, если карточка доступна (текущее время >= release)
 */
export function isReleased(releaseISO: string): boolean {
  const release = new Date(releaseISO).getTime();
  return Date.now() >= release;
}

/**
 * Форматирует ISO-дату для отображения (дд.мм.гггг чч:мм).
 */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
