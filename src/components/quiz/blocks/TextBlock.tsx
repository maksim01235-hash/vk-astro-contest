/**
 * components/quiz/blocks/TextBlock.tsx — текстовый блок (Markdown).
 * Рендерит Markdown с минимальным форматированием (заголовки, жирный, списки).
 * Для production можно подключить react-markdown, здесь — упрощённый рендер.
 */

'use client';

import type { TextBlock as TextBlockType } from '@/types';

interface Props {
  block: TextBlockType;
}

/**
 * Упрощённый Markdown-рендер: заголовки (##), жирный (**текст**), списки (-).
 * Для полной поддержки подключите react-markdown + remark-gfm.
 */
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  return lines.map((line, i) => {
    // Заголовок 2 уровня.
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="text-xl font-bold text-slate-900 mt-4 mb-2">
          {line.slice(3)}
        </h2>
      );
    }
    // Заголовок 3 уровня.
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} className="text-lg font-semibold text-slate-800 mt-3 mb-1">
          {line.slice(4)}
        </h3>
      );
    }
    // Пустая строка — отступ.
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }
    // Жирный текст **текст**.
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-slate-700 leading-relaxed mb-1">
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={j} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </p>
    );
  });
}

export function TextBlockView({ block }: Props) {
  return (
    <div className="card-surface prose prose-sm max-w-none">
      {renderMarkdown(block.content)}
    </div>
  );
}
