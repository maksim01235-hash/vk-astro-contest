'use client';

import { useEffect } from 'react';
import { MiniMap, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ImageItem } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  images: ImageItem[];
  initialIndex?: number;
}

export function ImageViewerModal({ open, onClose, images, initialIndex = 0 }: Props) {
  const index = Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0));
  const image = images[index];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open || !image) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Просмотр изображения">
      <div className="viewer-toolbar" role="toolbar">
        <button type="button" onClick={onClose} className="viewer-close-button" aria-label="Закрыть просмотр">×</button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <TransformWrapper key={image.id} initialScale={1} minScale={1} maxScale={4} centerOnInit wheel={{ step: 0.1 }} doubleClick={{ mode: 'zoomIn', step: 1 }} pinch={{ step: 5 }} panning={{ velocityDisabled: true }}>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full flex items-center justify-center">
            <img src={image.src} alt={image.alt || ''} className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-2rem)] select-none object-contain" draggable={false} />
          </TransformComponent>
          <MiniMap width={140} height={100} borderColor="#ffffff">
            <img src={image.src} alt="" aria-hidden="true" className="h-full w-full object-contain" />
          </MiniMap>
        </TransformWrapper>
      </div>
      {images.length > 1 && <div className="flex justify-center gap-3 px-4 pb-4 pt-2">{images.map((item, itemIndex) => <span key={item.id} className={`h-2 w-2 rounded-full ${itemIndex === index ? 'bg-white' : 'bg-white/40'}`} />)}</div>}
    </div>
  );
}
