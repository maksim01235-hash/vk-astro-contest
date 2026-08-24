/**
 * utils/serverClock.ts — оценка «серверного времени» на устройстве.
 *
 * Зачем: delta_seconds считается на клиенте как разница между временем
 * первого открытия карточки (проставленным СЕРВЕРОМ в листе Opens) и
 * моментом отправки. Если брать отправку по локальным часам, любое смещение
 * часов устройства искажает дельту вплоть до отрицательных значений
 * (реальный кейс: Answers id=33, delta_seconds = -36).
 *
 * Решение: при каждом успешном ответе с серверным временем измеряем смещение
 * offsetMs = serverMs − clientNow и далее считаем «серверное сейчас» как
 * Date.now() + offsetMs. До первого измерения используется локальное время.
 */

let offsetMs = 0;

/** Измерялось ли смещение хотя бы один раз за сессию. */
let measured = false;

/**
 * Запомнить серверное время из ответа API.
 * @param iso — серверный ISO-момент
 * @param requestStartedAt — Date.now() перед отправкой запроса; зная начало,
 *   берём середину интервала [начало, сейчас] — так компенсируется сетевая
 *   задержка (сервер проставил время где-то внутри этого окна).
 */
export function noteServerTime(iso: string, requestStartedAt?: number): void {
  const serverMs = new Date(iso).getTime();
  if (Number.isNaN(serverMs)) return;

  const clientNow = Date.now();
  const midpoint =
    typeof requestStartedAt === 'number' && Number.isFinite(requestStartedAt)
      ? (requestStartedAt + clientNow) / 2
      : clientNow;

  offsetMs = Math.round(serverMs - midpoint);
  measured = true;
}

/** «Серверное сейчас» в мс; до первого измерения — локальные часы. */
export function getServerNowMs(): number {
  return measured ? Date.now() + offsetMs : Date.now();
}

/** Для диагностики: текущее измеренное смещение (мс). */
export function getServerOffsetMs(): number {
  return measured ? offsetMs : 0;
}
