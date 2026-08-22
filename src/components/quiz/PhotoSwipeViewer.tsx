'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

export interface PhotoSwipeImage {
  id: string;
  src: string;
  alt?: string;
}

export interface MarkerPosition {
  x: number;
  y: number;
}

interface Props {
  open: boolean;
  images: PhotoSwipeImage[];
  initialIndex?: number;
  onClose: () => void;
  marker?: MarkerPosition;
  markerColor?: string;
  markerSizePercent?: number;
  markerEditable?: boolean;
  markerConfirmed?: boolean;
  onMarkerActivate?: () => void;
  onMarkerChange?: (position: MarkerPosition) => void;
  onMarkerConfirm?: () => void;
}

type Dimensions = Record<string, { width: number; height: number }>;

type PswpSlide = {
  data: { src?: string; width?: number; height?: number };
  currZoomLevel: number;
  pan: { x: number; y: number };
  zoomTo: (level: number, centerPoint?: { x: number; y: number }, transitionDuration?: number | false) => void;
  toggleZoom: (centerPoint?: { x: number; y: number }) => void;
};

type PswpCore = {
  currIndex: number;
  currSlide?: PswpSlide;
  viewportSize: { x: number; y: number };
  ui: {
    registerElement: (config: {
      name: string;
      order?: number;
      isButton?: boolean;
      tagName?: string;
      className?: string;
      html?: string;
      onInit?: (el: HTMLElement, pswp: PswpCore) => void;
      onClick?: (event: MouseEvent, el: HTMLElement, pswp: PswpCore) => void;
    }) => void;
  };
  close: () => void;
  on: (name: string, callback: () => void) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function loadDimensions(images: PhotoSwipeImage[]): Promise<Dimensions> {
  return Promise.all(
    images.map((image) => new Promise<[string, { width: number; height: number }]>((resolve) => {
      const img = new Image();
      img.onload = () => resolve([image.id, { width: img.naturalWidth || 1, height: img.naturalHeight || 1 }]);
      img.onerror = () => resolve([image.id, { width: 1, height: 1 }]);
      img.src = image.src;
    })),
  ).then((items) => Object.fromEntries(items));
}

export function PhotoSwipeViewer({
  open,
  images,
  initialIndex = 0,
  onClose,
  marker,
  markerColor = '#3B82F6',
  markerSizePercent = 5,
  markerEditable = false,
  markerConfirmed = false,
  onMarkerActivate,
  onMarkerChange,
  onMarkerConfirm,
}: Props) {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);
  const pswpRef = useRef<PswpCore | null>(null);
  const dimensionsRef = useRef<Dimensions>({});
  const markerRef = useRef(marker);
  const draggingRef = useRef(false);
  const activeRef = useRef(false);
  const confirmedRef = useRef(markerConfirmed);
  const [ready, setReady] = useState(false);

  markerRef.current = marker;
  confirmedRef.current = markerConfirmed;

  /**
   * Рамка миникарты строится по фактической матрице трансформации:
   * visible origin в координатах исходной картинки = -pan / zoom.
   * Это надёжнее panBounds: они могут быть одинаковыми на оси, где
   * изображение центрировано, и не отражают текущую позицию drag.
   */
  const syncMinimap = useCallback(() => {
    const pswp = pswpRef.current;
    const slide = pswp?.currSlide;
    if (!pswp || !slide) return;

    const root = document.querySelector('.pswp');
    const minimapImage = root?.querySelector<HTMLImageElement>('.contest-pswp__minimap-image');
    const viewport = root?.querySelector<HTMLElement>('.contest-pswp__minimap-viewport');
    const current = images[pswp.currIndex];
    if (!minimapImage || !viewport || !current) return;

    if (minimapImage.src !== current.src) minimapImage.src = current.src;

    const sourceWidth = Math.max(slide.data.width || 1, 1);
    const sourceHeight = Math.max(slide.data.height || 1, 1);
    const zoom = Math.max(slide.currZoomLevel || 1, 0.0001);
    const viewportWidth = Math.max(pswp.viewportSize.x || 1, 1);
    const viewportHeight = Math.max(pswp.viewportSize.y || 1, 1);

    // Размер видимой области относительно оригинальной картинки.
    const visibleImageWidth = viewportWidth / zoom;
    const visibleImageHeight = viewportHeight / zoom;
    const visibleWidthPercent = clamp((visibleImageWidth / sourceWidth) * 100, 0, 100);
    const visibleHeightPercent = clamp((visibleImageHeight / sourceHeight) * 100, 0, 100);

    // Координаты левого верхнего угла viewport в координатах картинки.
    // transform: screen = pan + imageCoordinate * zoom.
    // Поэтому imageCoordinate = (screen - pan) / zoom.
    const rawOriginX = -slide.pan.x / zoom;
    const rawOriginY = -slide.pan.y / zoom;

    // Когда изображение меньше viewport по одной оси, PhotoSwipe центрирует его.
    // Компенсируем свободное пространство, чтобы рамка оставалась по центру.
    const imageRenderedWidth = sourceWidth * zoom;
    const imageRenderedHeight = sourceHeight * zoom;
    const freeX = Math.max(0, viewportWidth - imageRenderedWidth) / 2;
    const freeY = Math.max(0, viewportHeight - imageRenderedHeight) / 2;
    const originX = (freeX - slide.pan.x) / zoom;
    const originY = (freeY - slide.pan.y) / zoom;

    const maxOriginX = Math.max(0, sourceWidth - visibleImageWidth);
    const maxOriginY = Math.max(0, sourceHeight - visibleImageHeight);
    const clippedOriginX = clamp(maxOriginX > 0 ? originX : sourceWidth / 2 - visibleImageWidth / 2, 0, Math.max(0, sourceWidth - visibleImageWidth));
    const clippedOriginY = clamp(maxOriginY > 0 ? originY : sourceHeight / 2 - visibleImageHeight / 2, 0, Math.max(0, sourceHeight - visibleImageHeight));

    const centerXPercent = clamp(((clippedOriginX + visibleImageWidth / 2) / sourceWidth) * 100, 0, 100);
    const centerYPercent = clamp(((clippedOriginY + visibleImageHeight / 2) / sourceHeight) * 100, 0, 100);

    viewport.style.width = `${visibleWidthPercent}%`;
    viewport.style.height = `${visibleHeightPercent}%`;
    viewport.style.left = `${centerXPercent}%`;
    viewport.style.top = `${centerYPercent}%`;
  }, [images]);

  const syncMarker = useCallback(() => {
    const pswp = pswpRef.current;
    const position = markerRef.current;
    if (!pswp?.currSlide || !position) return;

    const root = document.querySelector('.pswp');
    const dot = root?.querySelector<HTMLElement>('.contest-pswp__marker');
    const confirm = root?.querySelector<HTMLElement>('.contest-pswp__marker-confirm');
    if (!dot) return;

    const slide = pswp.currSlide;
    const zoom = slide.currZoomLevel || 1;
    const sourceWidth = slide.data.width || 1;
    const sourceHeight = slide.data.height || 1;
    const markerX = slide.pan.x + sourceWidth * zoom * (position.x / 100);
    const markerY = slide.pan.y + sourceHeight * zoom * (position.y / 100);
    const size = Math.max(20, Math.min(72, Math.min(sourceWidth, sourceHeight) * zoom * (markerSizePercent / 100)));

    dot.style.left = `${markerX}px`;
    dot.style.top = `${markerY}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.backgroundColor = markerColor;
    dot.style.display = 'block';

    if (confirm) {
      confirm.style.left = `${markerX}px`;
      confirm.style.top = `${Math.max(56, markerY - size / 2 - 38)}px`;
      confirm.style.display = activeRef.current ? 'flex' : 'none';
    }
  }, [markerColor, markerSizePercent]);

  const moveMarkerFromPointer = useCallback((clientX: number, clientY: number) => {
    const pswp = pswpRef.current;
    if (!pswp?.currSlide || !markerRef.current || !draggingRef.current) return;

    const slide = pswp.currSlide;
    const zoom = slide.currZoomLevel || 1;
    const width = slide.data.width || 1;
    const height = slide.data.height || 1;
    onMarkerChange?.({
      x: clamp(((clientX - slide.pan.x) / (width * zoom)) * 100, 0, 100),
      y: clamp(((clientY - slide.pan.y) / (height * zoom)) * 100, 0, 100),
    });
  }, [onMarkerChange]);

  useEffect(() => {
    if (!open || !images.length) return;
    let cancelled = false;
    void loadDimensions(images).then((dimensions) => {
      if (cancelled) return;
      dimensionsRef.current = dimensions;
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [images, open]);

  useEffect(() => {
    if (!open || !ready || lightboxRef.current || !images.length) return;

    const lightbox = new PhotoSwipeLightbox({
      dataSource: images.map((image) => ({
        src: image.src,
        alt: image.alt || '',
        width: dimensionsRef.current[image.id]?.width || 1,
        height: dimensionsRef.current[image.id]?.height || 1,
      })),
      pswpModule: () => import('photoswipe'),
      showHideAnimationType: 'fade',
      bgOpacity: 0.95,
      wheelToZoom: true,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      arrowKeys: images.length > 1,
    });

    lightbox.on('uiRegister', () => {
      const pswp = lightbox.pswp as unknown as PswpCore;
      pswpRef.current = pswp;

      pswp.ui.registerElement({
        name: 'contest-close',
        order: 1,
        isButton: true,
        tagName: 'button',
        className: 'contest-pswp__close',
        html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>',
        onClick: (_, __, instance) => instance.close(),
      });

      pswp.ui.registerElement({
        name: 'contest-minimap',
        order: 2,
        tagName: 'div',
        className: 'contest-pswp__minimap',
        html: '<img class="contest-pswp__minimap-image" alt="Навигатор изображения" /><div class="contest-pswp__minimap-viewport"></div>',
      });

      pswp.ui.registerElement({
        name: 'contest-zoom',
        order: 3,
        tagName: 'div',
        className: 'contest-pswp__zoom',
        html: '<button type="button" class="contest-pswp__zoom-in" aria-label="Увеличить">+</button><button type="button" class="contest-pswp__zoom-out" aria-label="Уменьшить">−</button>',
        onInit: (element, instance) => {
          element.querySelector<HTMLButtonElement>('.contest-pswp__zoom-in')?.addEventListener('click', () => instance.currSlide?.toggleZoom());
          element.querySelector<HTMLButtonElement>('.contest-pswp__zoom-out')?.addEventListener('click', () => {
            const slide = instance.currSlide;
            if (slide) slide.zoomTo(1, { x: instance.viewportSize.x / 2, y: instance.viewportSize.y / 2 }, 250);
          });
        },
      });

      if (marker) {
        pswp.ui.registerElement({
          name: 'contest-marker',
          order: 4,
          tagName: 'div',
          className: 'contest-pswp__marker',
          onInit: (element) => {
            element.addEventListener('click', (event) => {
              event.stopPropagation();
              if (!markerEditable || confirmedRef.current) return;
              activeRef.current = true;
              onMarkerActivate?.();
              syncMarker();
            });
            element.addEventListener('pointerdown', (event) => {
              if (!activeRef.current || confirmedRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              draggingRef.current = true;
              element.setPointerCapture?.(event.pointerId);
            });
            element.addEventListener('pointermove', (event) => moveMarkerFromPointer(event.clientX, event.clientY));
            element.addEventListener('pointerup', () => { draggingRef.current = false; });
          },
        });

        pswp.ui.registerElement({
          name: 'contest-marker-confirm',
          order: 5,
          isButton: true,
          tagName: 'button',
          className: 'contest-pswp__marker-confirm',
          html: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>',
          onClick: () => {
            if (!activeRef.current) return;
            draggingRef.current = false;
            activeRef.current = false;
            onMarkerConfirm?.();
            syncMarker();
          },
        });
      }

      pswp.on('change', () => { activeRef.current = false; syncMinimap(); syncMarker(); });
      pswp.on('zoomPanUpdate', () => {
        requestAnimationFrame(() => {
          syncMinimap();
          syncMarker();
        });
      });
      pswp.on('resize', () => { requestAnimationFrame(() => { syncMinimap(); syncMarker(); }); });
      requestAnimationFrame(() => { syncMinimap(); syncMarker(); });
    });

    lightbox.on('destroy', () => {
      pswpRef.current = null;
      lightboxRef.current = null;
      setReady(false);
      onClose();
    });

    lightbox.init();
    lightboxRef.current = lightbox;
    lightbox.loadAndOpen(Math.max(0, Math.min(initialIndex, images.length - 1)));

    return () => {
      lightbox.destroy();
      lightboxRef.current = null;
      pswpRef.current = null;
    };
  }, [images, initialIndex, marker, markerEditable, moveMarkerFromPointer, onClose, onMarkerActivate, onMarkerConfirm, open, ready, syncMarker, syncMinimap]);

  useEffect(() => {
    if (!open && lightboxRef.current) lightboxRef.current.destroy();
  }, [open]);

  return null;
}

export function PhotoSwipeViewerStyles() {
  return (
    <style jsx global>{`
      .pswp .pswp__top-bar { position:fixed !important; top:auto !important; right:0 !important; bottom:calc(16px + env(safe-area-inset-bottom, 0px)) !important; left:0 !important; width:100% !important; height:auto !important; min-height:0 !important; padding:0 !important; background:transparent !important; pointer-events:none; z-index:10000; }
      .pswp .pswp__top-bar > * { pointer-events:auto; }
      .pswp .pswp__button--close, .pswp .pswp__button--zoom, .pswp .pswp__button--arrow--prev, .pswp .pswp__button--arrow--next, .pswp .pswp__counter { display:none !important; }
      .pswp .contest-pswp__close, .pswp .contest-pswp__marker-confirm, .pswp .contest-pswp__zoom button { display:flex; align-items:center; justify-content:center; box-sizing:border-box; border:0; color:#fff; background:rgba(7,12,20,.78); box-shadow:0 4px 18px rgba(0,0,0,.38); cursor:pointer; }
      .pswp .contest-pswp__close { position:fixed; top:calc(16px + env(safe-area-inset-top, 0px)); left:calc(16px + env(safe-area-inset-left, 0px)); width:56px; height:56px; border-radius:50%; z-index:10010; }
      .pswp .contest-pswp__close svg { width:30px; height:30px; fill:none; stroke:currentColor; stroke-width:2.4; stroke-linecap:round; }
      .pswp .contest-pswp__minimap { position:fixed; left:calc(16px + env(safe-area-inset-left, 0px)); bottom:calc(16px + env(safe-area-inset-bottom, 0px)); width:min(30vw,300px); aspect-ratio:1; overflow:hidden; border:2px solid rgba(255,255,255,.88); border-radius:9px; background:#0b0f16; box-shadow:0 4px 18px rgba(0,0,0,.48); z-index:10010; }
      .pswp .contest-pswp__minimap-image { display:block; width:100%; height:100%; object-fit:contain; background:#0b0f16; }
      .pswp .contest-pswp__minimap-viewport { position:absolute; box-sizing:border-box; border:2px solid #fff; background:rgba(59,130,246,.22); transform:translate(-50%,-50%); pointer-events:none; }
      .pswp .contest-pswp__zoom { position:fixed; display:flex; flex-direction:column; gap:10px; right:calc(16px + env(safe-area-inset-right, 0px)); bottom:calc(16px + env(safe-area-inset-bottom, 0px)); z-index:10010; }
      .pswp .contest-pswp__zoom button { width:52px; height:52px; border-radius:50%; font-size:34px; font-weight:300; line-height:1; }
      .pswp .contest-pswp__marker { position:absolute; display:none; box-sizing:border-box; border:3px solid #fff; border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 0 3px rgba(0,0,0,.34),0 4px 14px rgba(0,0,0,.45); cursor:pointer; touch-action:none; z-index:10011; }
      .pswp .contest-pswp__marker-confirm { position:absolute; display:none; width:42px; height:42px; border-radius:50%; transform:translate(-50%,-100%); background:#16a34a; z-index:10012; }
      .pswp .contest-pswp__marker-confirm svg { width:25px; height:25px; fill:none; stroke:currentColor; stroke-width:2.8; stroke-linecap:round; stroke-linejoin:round; }
      @media (max-width:640px) { .pswp .contest-pswp__close { top:calc(12px + env(safe-area-inset-top, 0px)); left:calc(12px + env(safe-area-inset-left, 0px)); width:50px; height:50px; } .pswp .contest-pswp__minimap { left:calc(12px + env(safe-area-inset-left, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); width:min(30vw,180px); } .pswp .contest-pswp__zoom { right:calc(12px + env(safe-area-inset-right, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); } .pswp .contest-pswp__zoom button { width:46px; height:46px; font-size:30px; } }
    `}</style>
  );
}
