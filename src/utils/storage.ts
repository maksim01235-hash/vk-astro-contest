/**
 * utils/storage.ts — обёртка над localStorage с поддержкой TTL.
 * Используется для кеширования карточек, статуса репоста, времени открытия.
 *
 * Зачем: localStorage сам по себе не поддерживает TTL (время жизни кеша).
 * Эта обёртка хранит { value, expiresAt } и автоматически удаляет протухшие записи.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // timestamp (мс), когда кеш протухнет
}

/**
 * Сохранить значение в localStorage с TTL.
 * @param key — ключ
 * @param value — значение (любое сериализуемое)
 * @param ttlMs — время жизни в миллисекундах
 */
export function setWithTTL<T>(key: string, value: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    // localStorage может быть недоступен (приватный режим, квота).
    console.warn('[storage] setWithTTL failed:', key, e);
  }
}

/**
 * Получить значение из localStorage с проверкой TTL.
 * @returns значение или null, если кеш протух или отсутствует.
 */
export function getWithTTL<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      // Кеш протух — удаляем.
      localStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch (e) {
    console.warn('[storage] getWithTTL failed:', key, e);
    return null;
  }
}

/**
 * Удалить значение по ключу.
 */
export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[storage] remove failed:', key, e);
  }
}

/**
 * Простое сохранение без TTL (для флагов, очередей).
 */
export function setRaw<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[storage] setRaw failed:', key, e);
  }
}

/**
 * Простое чтение без TTL.
 */
export function getRaw<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn('[storage] getRaw failed:', key, e);
    return null;
  }
}
