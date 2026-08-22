'use client';

import { useMemo, useState } from 'react';
import type { ImageBlock as ImageBlockType } from '@/types';
import { ImageViewerModal } from '../ImageViewerModal';

interface Props {
  block: ImageBlockType;
}

function getImages(block: ImageBlockType) {
  if (block.images?.length) return block.images;
  if (block.src) {
    return [{ id: `${block.id}-legacy`, src: block.src, alt: block.alt || '' }];
  }
  return [];
}

export function ImageBlockView({ block }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const images = useMemo(() => getImages(block), [block]);

  const layoutStyle: React.CSSProperties =
    block.layoutMode === 'grid'
      ? { gridTemplateColumns: `repeat(${Math.max(1, Math.min(block.gridColumns || 2, 6))}, minmax(0, 1fr))` }
      : {};

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div
        className={block.layoutMode === 'grid' ? 'grid gap-3' : 'flex flex-wrap gap-3'}
        style={layoutStyle}
      >
        {images.map((image, index) => {
          const imageStyle: React.CSSProperties = {};
          if (typeof block.width === 'number') imageStyle.width = block.width;
          if (block.maxImageWidth) imageStyle.maxWidth = `${block.maxImageWidth}px`;
          if (block.maxImageHeight) imageStyle.maxHeight = `${block.maxImageHeight}px`;

          return (
            <div key={image.id} className="relative overflow-hidden rounded-xl border border-slate-200">
              <img
                src={image.src}
                alt={image.alt || ''}
                className={`${block.width === 'full' ? 'w-full' : ''} h-auto max-w-full object-contain block`}
                style={imageStyle}
              />
              {block.viewer && (
                <button
                  type="button"
                  onClick={() => openViewer(index)}
                  aria-label="Открыть изображение"
                  className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      {block.viewer && images.length > 0 && (
        <ImageViewerModal
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          images={images}
          initialIndex={viewerIndex}
        />
      )}
    </>
  );
}
