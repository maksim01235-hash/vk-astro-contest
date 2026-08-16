/**
 * utils/json.ts — хелперы для безопасной работы с JSON.
 */

/**
 * Безопасно парсит JSON-строку. При ошибке возвращает fallback.
 * @param str — JSON-строка
 * @param fallback — значение по умолчанию
 */
export function safeParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Безопасно stringify. При ошибке возвращает пустую строку.
 */
export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Генерирует уникальный ID (для блоков в конструкторе).
 * Использует crypto.randomUUID, если доступен, иначе fallback на Date + random.
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
