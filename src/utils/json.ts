/**
 * utils/json.ts — хелперы для безопасной работы с JSON.
 *
 * ПРАВКА: safeParseSchema — устойчивый парсер именно для json_schema карточек.
 * Если Google Sheets/Apps Script когда-либо записали значение с двойным
 * JSON-экранированием (строка внутри строки: '"{\"blocks\":[...]}"'),
 * обычный JSON.parse даёт на выходе снова строку, а не объект — и
 * schema.blocks оказывается undefined, блоки не появляются в редакторе.
 * Эта функция пытается распарсить повторно, если первый результат —
 * тоже строка.
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
 * Парсит JSON-схему карточки, устойчиво к двойному экранированию.
 * Если после первого JSON.parse результат — снова строка (а не объект),
 * пытается распарсить ещё раз. Логирует случай двойного экранирования
 * в консоль, чтобы можно было отследить источник проблемы в Sheets.
 */
export function safeParseSchema<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  let value: unknown;
  try {
    value = JSON.parse(str);
  } catch {
    return fallback;
  }
  // Двойное экранирование: после парсинга снова получили строку.
  if (typeof value === 'string') {
    console.warn('[safeParseSchema] обнаружено двойное JSON-экранирование, повторный парсинг');
    try {
      value = JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
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
