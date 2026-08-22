/**
 * src/components/quiz/blocks/ImageBlock.tsx — отображение одиночной картинки или галереи.
 * Полноэкранный просмотр реализован через общий PhotoSwipeViewer.
 */

'use client';

import { useMemo, useState } from 'react';
import type { ImageBlock as ImageBlockType } from '@/types';
import {
  PhotoSwipeViewer,
  PhotoSwipeViewerStyles,
  type PhotoSwipeImage,
} from '@/components/quiz/PhotoSwipeViewer';
import clsx from 'clsx';

interface Props {
  block: ImageBlockType;
}

export function ImageBlockView({ block }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const images = useMemo<PhotoSwipeImage[]>(() => {
    if (block.images && block.images.length > 0) {
      return block.images.filter((image) => !!image.src);
    }

    return block.src
      ? [{ id: `${block.id}-single`, src: block.src, alt: block.alt || '' }]
      : [];
  }, [block.alt, block.id, block.images, block.src]);

  const openViewer = (index: number) => {
    if (block.viewer === false || !images[index]) return;
    setSelectedIndex(index);
    setViewerOpen(true);
  };

  if (images.length === 0) {
    return (
      <div className="card-surface text-center text-slate-500">
        Для блока изображения не указан URL.
      </div>
    );
  }

  const isGallery = block.images && block.images.length > 0;
  const layoutMode = block.layoutMode || 'flex';
  const gridColumns = Math.max(1, Math.min(6, block.gridColumns || 3));

  return (
    <div className="flex flex-col gap-3">
      {isGallery && layoutMode === 'grid' ? (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => openViewer(index)}
              className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 text-left"
              aria-label={`Открыть изображение ${index + 1}`}
            >
              <img
                src={image.src}
                alt={image.alt || ''}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : isGallery ? (
        <div className="flex flex-wrap gap-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => openViewer(index)}
              className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 text-left sm:w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)] lg:w-[calc(25%-0.5625rem)]"
              aria-label={`Открыть изображение ${index + 1}`}
            >
              <img
                src={image.src}
                alt={image.alt || ''}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openViewer(0)}
          className={clsx(
            'relative block w-full overflow-hidden rounded-xl bg-slate-100 text-left',
            block.viewer !== false && 'cursor-zoom-in',
          )}
          style={{ maxWidth: block.maxImageWidth || '100%' }}
          disabled={block.viewer === false}
          aria-label="Открыть изображение"
        >
          <img
            src={images[0].src}
            alt={images[0].alt || ''}
            className="block w-full"
            style={{ maxHeight: block.maxImageHeight || undefined, objectFit: 'contain' }}
          />
        </button>
      )}

      <PhotoSwipeViewerStyles />
      <PhotoSwipeViewer
        open={viewerOpen}
        images={images}
        initialIndex={selectedIndex}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
