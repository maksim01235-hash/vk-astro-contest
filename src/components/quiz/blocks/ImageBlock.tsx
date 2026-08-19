/**
 * components/quiz/blocks/ImageBlock.tsx — картинка в карточке.
 *
 * ВАЖНО: путь замены — vk-contest-mini-app/src/components/quiz/blocks/ImageBlock.tsx
 * (файл лежит ВНУТРИ подпапки blocks, не путайте с корнем quiz/).
 * После замены рядом ДОЛЖЕН существовать файл:
 * vk-contest-mini-app/src/components/quiz/ImageViewerModal.tsx (создаётся отдельно).
 */

'use client';

import { useState } from 'react';
import { ImageBlock as ImageBlockType } from '@/types';
import { ImageViewerModal } from '../ImageViewerModal';

interface Props {
  block: ImageBlockType;
}

export function ImageBlockView({ block }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const widthClass = block.width === 'full' ? 'w-full' : '';
  const style = typeof block.width === 'number' ? { width: block.width } : undefined;

  const containerStyle: React.CSSProperties = {};
  if (block.maxImageWidth) containerStyle.maxWidth = `${block.maxImageWidth}px`;
  if (block.maxImageHeight) containerStyle.maxHeight = `${block.maxImageHeight}px`;
  if (block.maxImageWidth || block.maxImageHeight) {
    containerStyle.display = 'inline-block';
  }

  return (
    <>
      <div
        className="relative rounded-xl overflow-hidden border border-slate-200"
        style={containerStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.src}
          alt={block.alt || ''}
          className={`${widthClass} h-auto object-cover block`}
          style={style}
        />

        {block.viewer && (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            aria-label="Открыть в полноэкранном режиме"
            className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80
                       flex items-center justify-center text-white transition-colors z-10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M10.5 8V13M8 10.5H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M15 15L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {block.viewer && (
        <ImageViewerModal
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          src={block.src}
          alt={block.alt || ''}
        />
      )}
    </>
  );
}