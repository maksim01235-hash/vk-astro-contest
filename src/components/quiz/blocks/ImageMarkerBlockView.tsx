/**
 * src/components/quiz/blocks/ImageMarkerBlockView.tsx — изображение с перемещаемой меткой.
 *
 * Концепция: пользователь отмечает на фотографии определённое место.
 *  - Во встроенном виде метка показывает текущую позицию (изначально центр фото).
 *  - В полноэкранном просмотре первый тап активирует метку на 3 секунды;
 *    за это время нужно нажать и перетащить её. Отпускание пальца фиксирует позицию.
 *  - Координаты (0–100%) уходят в ответе как marker.userX/userY,
 *    проверку выполняет Apps Script (checkMarkerAnswer).
 *  - Для вошедшего админа (флаг STORAGE_ADMIN_AUTH) на фото отображается
 *    бейдж с текущими координатами метки — удобно подбирать correctX/correctY.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImageMarkerBlock } from '@/types';
import {
  PhotoSwipeViewer,
  PhotoSwipeViewerStyles,
  type MarkerPosition,
  type PhotoSwipeImage,
} from '@/components/quiz/PhotoSwipeViewer';
import { logEvent } from '@/lib/sheets/logger';
import { getRaw } from '@/utils/storage';
import { STORAGE_ADMIN_AUTH } from '@/constants';
import clsx from 'clsx';

interface Props {
  block: ImageMarkerBlock;
  /** Текущая позиция метки в процентах 0–100 (состояние хранит CardRenderer). */
  position: MarkerPosition;
  onPositionChange: (position: MarkerPosition) => void;
}

export function ImageMarkerBlockView({ block, position, onPositionChange }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);
  // Флаг админа читаем после монтирования: localStorage недоступен при
  // пререндере, а раннее чтение дало бы рассинхрон гидратации.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(getRaw<boolean>(STORAGE_ADMIN_AUTH) === true);
  }, []);

  // Стабильный массив изображений: пересоздание приводило бы к destroy/init лайтбокса.
  const images = useMemo<PhotoSwipeImage[]>(
    () => [{ id: block.id, src: block.src, alt: block.alt || '' }],
    [block.alt, block.id, block.src],
  );

  const handleMarkerChange = useCallback(
    (next: MarkerPosition) => {
      void logEvent('marker_move', {
        x: Math.round(next.x * 10) / 10,
        y: Math.round(next.y * 10) / 10,
      });
      onPositionChange(next);
    },
    [onPositionChange],
  );

  const openViewer = useCallback(() => {
    if (block.viewer === false) return;
    void logEvent('marker_click', { x: Math.round(position.x), y: Math.round(position.y) });
    setViewerOpen(true);
  }, [block.viewer, position.x, position.y]);

  if (!block.src) {
    return (
      <div className="card-surface text-center text-slate-500">
        Для блока с маркером не указан URL изображения.
      </div>
    );
  }

  const sizePercent = block.markerSizePercent || 5;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={openViewer}
        disabled={block.viewer === false}
        className={clsx(
          'relative block w-full cursor-default overflow-hidden rounded-xl bg-slate-100 text-left',
          block.viewer !== false && 'cursor-zoom-in',
        )}
        aria-label="Открыть изображение для перемещения метки"
      >
        {/* Без objectFit и жёстких размеров: рамка img совпадает с картинкой,
            поэтому проценты метки точно соответствуют позиции на фото. */}
        <img
          src={block.src}
          alt={block.alt || ''}
          loading="lazy"
          className="mx-auto block"
          style={{
            maxWidth: block.maxImageWidth || '100%',
            maxHeight: block.maxImageHeight || undefined,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full border-2 border-white shadow-md"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${sizePercent}%`,
            aspectRatio: '1',
            backgroundColor: block.markerColor || '#3B82F6',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 2px rgba(0,0,0,.3)',
          }}
        />
        {isAdmin && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white">
            X: {Math.round(position.x)}%, Y: {Math.round(position.y)}%
          </span>
        )}
      </button>

      {block.viewer !== false && (
        <p className="text-xs leading-relaxed text-slate-500">
          Отметьте место на фото: откройте изображение и перетащите метку.
        </p>
      )}

      <PhotoSwipeViewerStyles />
      <PhotoSwipeViewer
        key={block.id}
        open={viewerOpen}
        images={images}
        onClose={() => setViewerOpen(false)}
        marker={position}
        markerColor={block.markerColor || '#3B82F6'}
        markerSizePercent={sizePercent}
        onMarkerChange={handleMarkerChange}
        showMarkerCoords={isAdmin}
      />
    </div>
  );
}
