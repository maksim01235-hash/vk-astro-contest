/**
 * src/components/quiz/blocks/ImageMarkerBlock.tsx — блок с изображением и фиксируемой меткой.
 * Координаты метки хранятся в процентах от размеров исходной картинки.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ImageMarkerBlock as ImageMarkerBlockType } from '@/types';
import {
  PhotoSwipeViewer,
  PhotoSwipeViewerStyles,
  type MarkerPosition,
} from '@/components/quiz/PhotoSwipeViewer';
import { logEvent } from '@/lib/sheets/logger';
import { STORAGE_ADMIN_AUTH } from '@/constants';
import { getRaw } from '@/utils/storage';

interface Props {
  block: ImageMarkerBlockType;
  onMarkerChange: (x: number, y: number, confirmed: boolean) => void;
  onMarkerConfirm: (confirmed: boolean) => void;
}

export function ImageMarkerBlockView({ block, onMarkerChange, onMarkerConfirm }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [position, setPosition] = useState<MarkerPosition>({ x: 50, y: 50 });
  const [isActive, setIsActive] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const image = useMemo(() => [{
    id: `${block.id}-image`,
    src: block.src,
    alt: block.alt || '',
  }], [block.alt, block.id, block.src]);

  const markerColor = block.markerColor || '#3B82F6';
  const markerSize = Math.max(2, Math.min(20, block.markerSizePercent || 5));

  useEffect(() => {
    setIsAdmin(!!getRaw<boolean>(STORAGE_ADMIN_AUTH));
  }, []);

  const activateMarker = () => {
    if (isConfirmed) return;
    setIsActive(true);
    void logEvent('marker_click', { block_id: block.id, x: position.x, y: position.y });
  };

  const updateMarker = (next: MarkerPosition) => {
    setPosition(next);
    setIsConfirmed(false);
    onMarkerConfirm(false);
    onMarkerChange(next.x, next.y, false);
    void logEvent('marker_move', { block_id: block.id, x: next.x, y: next.y });
  };

  const confirmMarker = () => {
    if (!isActive) return;
    setIsActive(false);
    setIsConfirmed(true);
    onMarkerConfirm(true);
    onMarkerChange(position.x, position.y, true);
    void logEvent('marker_confirm', { block_id: block.id, x: position.x, y: position.y });
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-slate-100 text-left"
        style={{ maxWidth: block.maxImageWidth || '100%' }}
        onClick={() => setViewerOpen(true)}
        aria-label="Открыть изображение и установить метку"
      >
        <img
          src={block.src}
          alt={block.alt || 'Изображение с меткой'}
          className="block w-full"
          style={{ maxHeight: block.maxImageHeight || undefined, objectFit: 'contain' }}
        />
        <span
          className="pointer-events-none absolute rounded-full border-[3px] border-white shadow-lg"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${markerSize}%`,
            aspectRatio: '1',
            transform: 'translate(-50%, -50%)',
            backgroundColor: markerColor,
            boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.3)',
          }}
        />
        {isAdmin && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-2 py-1 font-mono text-xs text-white">
            X: {position.x.toFixed(1)}%, Y: {position.y.toFixed(1)}%
          </span>
        )}
      </button>

      {!isConfirmed && (
        <p className="text-sm text-slate-500">
          Откройте изображение, переместите метку и подтвердите её положение.
        </p>
      )}
      {isConfirmed && (
        <p className="text-sm font-medium text-green-600">Положение метки зафиксировано.</p>
      )}

      <PhotoSwipeViewerStyles />
      <PhotoSwipeViewer
        open={viewerOpen}
        images={image}
        onClose={() => setViewerOpen(false)}
        marker={position}
        markerColor={markerColor}
        markerSizePercent={markerSize}
        markerEditable={!isConfirmed}
        markerConfirmed={isConfirmed}
        onMarkerActivate={activateMarker}
        onMarkerChange={updateMarker}
        onMarkerConfirm={confirmMarker}
      />
    </div>
  );
}
