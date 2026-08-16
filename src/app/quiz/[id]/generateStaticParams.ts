/**
 * app/quiz/[id]/generateStaticParams.tsx — пребилд ID карточек для static export.
 *
 * ВАЖНО: Next.js с output: 'export' требует знать все динамические параметры
 * при сборке. Мы берём ID из NEXT_PUBLIC_PREBUILD_CARD_IDS (через запятую).
 *
 * ОГРАНИЧЕНИЕ: новые карточки, добавленные в Google Sheets после деплоя,
 * НЕ будут доступны по /quiz/[new_id] без пересборки.
 * Альтернатива: использовать /quiz?id=X (query param) вместо [id] —
 * см. README → "Ограничения статического экспорта".
 */

export async function generateStaticParams() {
  const ids = (process.env.NEXT_PUBLIC_PREBUILD_CARD_IDS || '1,2,3')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.map((id) => ({ id }));
}
