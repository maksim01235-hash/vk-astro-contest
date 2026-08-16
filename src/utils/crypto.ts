/**
 * utils/crypto.ts — хеширование пароля админки на клиенте (SHA-256).
 *
 * ВАЖНО: это защита от случайного доступа, НЕ криптографическая.
 * Хеш хранится в собранном коде и виден всем. Любой может вызвать Apps Script напрямую.
 * Для реальной защиты нужен серверный секрет + проверка подписи VK launch params.
 */

/**
 * Вычисляет SHA-256-хеш строки и возвращает hex.
 * @param text — исходный текст (пароль)
 * @returns hex-строка хеша
 */
export async function sha256(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback для окружений без WebCrypto (очень редкий случай).
    throw new Error('WebCrypto API недоступен');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // ArrayBuffer → hex.
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Проверяет, совпадает ли введённый пароль с хешем.
 * @param input — введённый пароль
 * @param hash — ожидаемый SHA-256-хеш
 */
export async function verifyPassword(
  input: string,
  hash: string,
): Promise<boolean> {
  const inputHash = await sha256(input);
  return inputHash === hash;
}
