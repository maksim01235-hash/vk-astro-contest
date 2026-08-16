/**
 * components/quiz/blocks/ImageBlock.tsx — картинка в карточке.
 */

'use client';

import { ImageBlock as ImageBlockType } from '@/types';

interface Props {
  block: ImageBlockType;
}

export function ImageBlockView({ block }: Props) {
  const widthClass = block.width === 'full' ? 'w-full' : '';
  const style = typeof block.width === 'number' ? { width: block.width } : undefined;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
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
