/**
 * utils/json.ts — хелперы для безопасной работы с JSON.
 *
 * Утилиты используются для разбора схем карточек, сохранения JSON
 * и генерации идентификаторов блоков.
 */

/**
 * Безопасно парсит JSON-строку.
 *
 * @param str — JSON-строка
 * @param fallback — значение, которое возвращается при ошибке
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
 * Парсит JSON-схему карточки.
 *
 * Google Sheets или Apps Script могут вернуть JSON:
 *
 * 1. как обычную строку с объектом;
 * 2. как строку, внутри которой находится JSON-строка.
 *
 * Поэтому после первого разбора проверяем, не осталась ли строка,
 * и при необходимости выполняем второй JSON.parse.
 */
export function safeParseSchema<T>(
  str: string | null | undefined,
  fallback: T,
): T {
  if (!str) return fallback;

  let value: unknown;

  try {
    value = JSON.parse(str);
  } catch {
    return fallback;
  }

  if (typeof value === 'string') {
    console.warn(
      '[safeParseSchema] обнаружено двойное JSON-экранирование, повторный парсинг',
    );

    try {
      value = JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return (value as T) ?? fallback;
}

/**
 * Безопасно сериализует значение в JSON.
 *
 * @param value — значение для сериализации
 * @returns JSON-строка либо пустая строка при ошибке
 */
export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Генерирует уникальный идентификатор.
 *
 * Использует crypto.randomUUID(), если API доступен.
 * Иначе применяется запасной вариант на базе времени и случайного значения.
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}