'use client';

import { useEffect, useRef, useState } from 'react';
import { MiniMap, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ImageItem } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  images: ImageItem[];
  initialIndex?: number;
}

const VIEWPORT_RATIO = 0.3;
const FALLBACK_RATIO = 1.4;
const GAP = 12;

interface Metrics {
  naturalWidth: number;
  naturalHeight: number;
  previewWidth: number;
  previewHeight: number;
}

export function ImageViewerModal({ open, onClose, images, initialIndex = 0 }: Props) {
  const index = Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0));
  const image = images[index];
  const [metrics, setMetrics] = useState<Metrics>({ naturalWidth: 1, naturalHeight: 1, previewWidth: 1, previewHeight: 1 });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open || !image?.src) return;
    let cancelled = false;
    const update = () => {
      const previewWidth = Math.max(1, Math.round(window.innerWidth * VIEWPORT_RATIO));
      const probe = new window.Image();
      probe.onload = () => {
        if (cancelled) return;
        const naturalWidth = probe.naturalWidth || previewWidth;
        const naturalHeight = probe.naturalHeight || Math.round(previewWidth / FALLBACK_RATIO);
        setMetrics({ naturalWidth, naturalHeight, previewWidth, previewHeight: Math.max(1, Math.round(previewWidth * naturalHeight / naturalWidth)) });
      };
      probe.onerror = () => {
        if (!cancelled) setMetrics({ naturalWidth: previewWidth, naturalHeight: Math.round(previewWidth / FALLBACK_RATIO), previewWidth, previewHeight: Math.round(previewWidth / FALLBACK_RATIO) });
      };
      probe.src = image.src;
    };
    update();
    window.addEventListener('resize', update);
    return () => { cancelled = true; window.removeEventListener('resize', update); };
  }, [open, image?.src]);

  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open || !image) return null;

  const { previewWidth, previewHeight } = metrics;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Просмотр изображения">
      <button type="button" onClick={onClose} className="fixed left-3 z-[120] flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white shadow-lg hover:bg-black/85" style={{ top: `calc(env(safe-area-inset-top, 0px) + ${GAP}px)` }} aria-label="Закрыть просмотр">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <TransformWrapper key={image.id} initialScale={1} minScale={1} maxScale={50} centerOnInit wheel={{ step: 0.1 }} doubleClick={{ mode: 'zoomIn', step: 1 }} pinch={{ step: 5 }} panning={{ velocityDisabled: true }}>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full flex items-center justify-center">
            <img src={image.src} alt={image.alt || ''} className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-2rem)] select-none object-contain" draggable={false} />
          </TransformComponent>

          <div className="fixed left-3 z-[110] rounded-lg bg-black/60 shadow-xl" style={{ width: previewWidth, height: previewHeight, bottom: `calc(env(safe-area-inset-bottom, 0px) + ${GAP}px)`, touchAction: 'auto' }} onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; event.stopPropagation(); }} onPointerMove={(event) => { if (!pointerStart.current) return; const distance = Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y); if (distance > 4) event.preventDefault(); event.stopPropagation(); }} onPointerUp={(event) => { pointerStart.current = null; event.stopPropagation(); }} onPointerCancel={() => { pointerStart.current = null; }}>
            <MiniMap width={previewWidth} height={previewHeight} borderColor="#ffffff">
              <img src={image.src} alt="" aria-hidden="true" width={previewWidth} height={previewHeight} className="block" style={{ width: previewWidth, height: previewHeight, objectFit: 'contain' }} draggable={false} />
            </MiniMap>
          </div>
        </TransformWrapper>
      </div>
    </div>
  );
}
