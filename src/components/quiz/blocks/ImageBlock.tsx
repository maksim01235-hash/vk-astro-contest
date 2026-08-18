/**
 * components/quiz/blocks/ImageBlock.tsx — картинка в карточке.
 *
 * Обновления (v2):
 *  - Добавлены maxImageWidth и maxImageHeight для ограничения размера.
 */

'use client';

import { ImageBlock as ImageBlockType } from '@/types';

interface Props {
  block: ImageBlockType;
}

export function ImageBlockView({ block }: Props) {
  const widthClass = block.width === 'full' ? 'w-full' : '';
  const style = typeof block.width === 'number' ? { width: block.width } : undefined;

  // Применяем maxImageWidth/maxImageHeight если заданы.
  const containerStyle: React.CSSProperties = {};
  if (block.maxImageWidth) {
    containerStyle.maxWidth = `${block.maxImageWidth}px`;
  }
  if (block.maxImageHeight) {
    containerStyle.maxHeight = `${block.maxImageHeight}px`;
  }
  if (block.maxImageWidth || block.maxImageHeight) {
    containerStyle.display = 'inline-block';
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200" style={containerStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.src}
        alt={block.alt || ''}
        className={`${widthClass} h-auto object-cover`}
        style={style}
      />
    </div>
  );
}