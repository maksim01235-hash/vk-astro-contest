/**
 * app/quiz/[id]/page.tsx — server-обёртка для /quiz/[id].
 *
 * Next.js 14 App Router: page.tsx — server component.
 * Экспортируем generateStaticParams (для static export) и
 * рендерим клиентский QuizClient внутри Suspense.
 *
 * В Next 14 params — это синхронный объект (не Promise).
 */

import { Suspense } from 'react';
import { QuizClient } from './QuizClient';

export { generateStaticParams } from './generateStaticParams';

export default function QuizPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      }
    >
      <QuizClient cardId={params.id} />
    </Suspense>
  );
}
