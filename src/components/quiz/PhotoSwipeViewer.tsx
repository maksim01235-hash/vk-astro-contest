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

function stopPhotoSwipeEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

function getCurrentImage(root: Element | null): HTMLImageElement | null {
  if (!root) return null;
  const all = Array.from(root.querySelectorAll<HTMLImageElement>('.pswp__img'));
  return all.find((image) => {
    const rect = image.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && getComputedStyle(image).visibility !== 'hidden';
  }) || null;
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
  const markerLayerRef = useRef<HTMLDivElement | null>(null);
  const markerDotRef = useRef<HTMLButtonElement | null>(null);
  const markerConfirmRef = useRef<HTMLButtonElement | null>(null);
  const draggingRef = useRef(false);
  const activeRef = useRef(false);
  const confirmedRef = useRef(markerConfirmed);
  const pointerDownRef = useRef(false);
  const didDragRef = useRef(false);
  const [ready, setReady] = useState(false);

  markerRef.current = marker;
  confirmedRef.current = markerConfirmed;

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
    const visibleImageWidth = viewportWidth / zoom;
    const visibleImageHeight = viewportHeight / zoom;
    const visibleWidthPercent = clamp((visibleImageWidth / sourceWidth) * 100, 0, 100);
    const visibleHeightPercent = clamp((visibleImageHeight / sourceHeight) * 100, 0, 100);
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

    viewport.style.width = `${visibleWidthPercent}%`;
    viewport.style.height = `${visibleHeightPercent}%`;
    viewport.style.left = `${clamp(((clippedOriginX + visibleImageWidth / 2) / sourceWidth) * 100, 0, 100)}%`;
    viewport.style.top = `${clamp(((clippedOriginY + visibleImageHeight / 2) / sourceHeight) * 100, 0, 100)}%`;
  }, [images]);

  const syncMarker = useCallback(() => {
    const root = document.querySelector('.pswp');
    const image = getCurrentImage(root);
    const layer = markerLayerRef.current;
    const dot = markerDotRef.current;
    const confirm = markerConfirmRef.current;
    const position = markerRef.current;
    if (!root || !image || !layer || !dot || !position) return;

    const rootRect = root.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    if (imageRect.width < 1 || imageRect.height < 1) return;

    const x = imageRect.left - rootRect.left + imageRect.width * (clamp(position.x, 0, 100) / 100);
    const y = imageRect.top - rootRect.top + imageRect.height * (clamp(position.y, 0, 100) / 100);
    const size = clamp(Math.min(imageRect.width, imageRect.height) * (markerSizePercent / 100), 20, 72);

    layer.style.display = 'block';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.backgroundColor = markerColor;
    dot.style.display = 'block';

    if (confirm) {
      confirm.style.left = `${x}px`;
      confirm.style.top = `${Math.max(54, y - size / 2 - 10)}px`;
      confirm.style.display = activeRef.current ? 'flex' : 'none';
    }
  }, [markerColor, markerSizePercent]);

  const moveMarkerFromPointer = useCallback((clientX: number, clientY: number) => {
    const root = document.querySelector('.pswp');
    const image = getCurrentImage(root);
    if (!image || !draggingRef.current || !activeRef.current || confirmedRef.current) return;

    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    onMarkerChange?.({
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    });
  }, [onMarkerChange]);

  const mountMarkerOverlay = useCallback(() => {
    if (!marker) return;
    const root = document.querySelector('.pswp') as HTMLElement | null;
    if (!root) return;

    markerLayerRef.current?.remove();

    const layer = document.createElement('div');
    layer.className = 'contest-pswp__marker-layer';

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'contest-pswp__marker';
    dot.setAttribute('aria-label', 'Активировать перемещение метки');

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'contest-pswp__marker-confirm';
    confirm.setAttribute('aria-label', 'Зафиксировать положение метки');
    confirm.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg>';

    const intercept = (event: Event) => {
      event.stopPropagation();
    };
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'touchstart', 'touchmove', 'touchend'].forEach((name) => {
      dot.addEventListener(name, intercept, { capture: true, passive: false });
      confirm.addEventListener(name, intercept, { capture: true, passive: false });
    });

    // Marker dot: tap activates, drag moves.
    dot.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointerDownRef.current = true;
      didDragRef.current = false;

      // If already active and not confirmed, start drag immediately.
      if (activeRef.current && !confirmedRef.current && markerEditable) {
        draggingRef.current = true;
        dot.setPointerCapture?.(event.pointerId);
        return;
      }

      // Otherwise we will decide on pointerup whether this was a tap.
    });

    dot.addEventListener('pointermove', (event) => {
      if (!pointerDownRef.current) return;

      // If already dragging, just move.
      if (draggingRef.current && activeRef.current && !confirmedRef.current && markerEditable) {
        const movement = Math.hypot(event.movementX, event.movementY);
        if (movement > 2) didDragRef.current = true;
        moveMarkerFromPointer(event.clientX, event.clientY);
        return;
      }

      // If not yet dragging, check if movement is enough to start drag.
      if (activeRef.current && !confirmedRef.current && markerEditable) {
        const movement = Math.hypot(event.movementX, event.movementY);
        if (movement > 4) {
          draggingRef.current = true;
          didDragRef.current = true;
          dot.setPointerCapture?.(event.pointerId);
        }
      }
    });

    const finishDot = (event: PointerEvent) => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;

      // If we were dragging, just stop.
      if (draggingRef.current) {
        draggingRef.current = false;
        didDragRef.current = false;
        if (dot.hasPointerCapture?.(event.pointerId)) dot.releasePointerCapture?.(event.pointerId);
        return;
      }

      // If not dragging and not confirmed, treat as tap → activate.
      if (!didDragRef.current && !confirmedRef.current && markerEditable) {
        activeRef.current = true;
        onMarkerActivate?.();
        syncMarker();
      }

      draggingRef.current = false;
      didDragRef.current = false;
    };

    dot.addEventListener('pointerup', finishDot);
    dot.addEventListener('pointercancel', finishDot);
    dot.addEventListener('lostpointercapture', () => { draggingRef.current = false; });

    // Confirm button: tap confirms, drag is ignored.
    confirm.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !activeRef.current) return;
      pointerDownRef.current = true;
      didDragRef.current = false;
    });

    confirm.addEventListener('pointermove', (event) => {
      if (!pointerDownRef.current) return;
      const movement = Math.hypot(event.movementX, event.movementY);
      if (movement > 4) didDragRef.current = true;
    });

    const finishConfirm = (event: PointerEvent) => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;

      if (!didDragRef.current && activeRef.current) {
        draggingRef.current = false;
        activeRef.current = false;
        onMarkerConfirm?.();
        syncMarker();
      }
      didDragRef.current = false;
    };

    confirm.addEventListener('pointerup', finishConfirm);
    confirm.addEventListener('pointercancel', finishConfirm);

    layer.append(dot, confirm);
    root.appendChild(layer);
    markerLayerRef.current = layer;
    markerDotRef.current = dot;
    markerConfirmRef.current = confirm;
    syncMarker();
  }, [marker, markerEditable, moveMarkerFromPointer, onMarkerActivate, onMarkerConfirm, syncMarker]);

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
      pinchToClose: false,
      closeOnVerticalDrag: false,
      arrowKeys: images.length > 1,
    });

    lightbox.on('uiRegister', () => {
      const pswp = lightbox.pswp as unknown as PswpCore;
      pswpRef.current = pswp;

      pswp.ui.registerElement({
        name: 'contest-close', order: 1, isButton: true, tagName: 'button', className: 'contest-pswp__close',
        html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>',
        onClick: (_, __, instance) => instance.close(),
      });

      pswp.ui.registerElement({
        name: 'contest-minimap', order: 2, tagName: 'div', className: 'contest-pswp__minimap',
        html: '<img class="contest-pswp__minimap-image" alt="Навигатор изображения" /><div class="contest-pswp__minimap-viewport"></div>',
      });

      pswp.ui.registerElement({
        name: 'contest-zoom', order: 3, tagName: 'div', className: 'contest-pswp__zoom',
        html: '<button type="button" class="contest-pswp__zoom-in" aria-label="Увеличить">+</button><button type="button" class="contest-pswp__zoom-out" aria-label="Уменьшить">−</button>',
        onInit: (element, instance) => {
          element.querySelector<HTMLButtonElement>('.contest-pswp__zoom-in')?.addEventListener('click', () => instance.currSlide?.toggleZoom());
          element.querySelector<HTMLButtonElement>('.contest-pswp__zoom-out')?.addEventListener('click', () => {
            const slide = instance.currSlide;
            if (slide) slide.zoomTo(1, { x: instance.viewportSize.x / 2, y: instance.viewportSize.y / 2 }, 250);
          });
        },
      });

      pswp.on('change', () => {
        activeRef.current = false;
        draggingRef.current = false;
        pointerDownRef.current = false;
        didDragRef.current = false;
        requestAnimationFrame(() => {
          mountMarkerOverlay();
          syncMinimap();
          syncMarker();
        });
      });

      pswp.on('zoomPanUpdate', () => {
        syncMinimap();
        syncMarker();
      });

      pswp.on('resize', () => requestAnimationFrame(() => {
        syncMinimap();
        syncMarker();
      }));

      requestAnimationFrame(() => {
        mountMarkerOverlay();
        syncMinimap();
        syncMarker();
      });
    });

    lightbox.on('destroy', () => {
      draggingRef.current = false;
      activeRef.current = false;
      pointerDownRef.current = false;
      didDragRef.current = false;
      markerLayerRef.current?.remove();
      markerLayerRef.current = null;
      markerDotRef.current = null;
      markerConfirmRef.current = null;
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
      markerLayerRef.current?.remove();
      markerLayerRef.current = null;
      markerDotRef.current = null;
      markerConfirmRef.current = null;
      lightboxRef.current = null;
      pswpRef.current = null;
    };
  }, [images, initialIndex, mountMarkerOverlay, onClose, open, ready, syncMarker, syncMinimap]);

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
      .pswp .contest-pswp__close, .pswp .contest-pswp__zoom button { display:flex; align-items:center; justify-content:center; box-sizing:border-box; border:0; color:#fff; background:rgba(7,12,20,.78); box-shadow:0 4px 18px rgba(0,0,0,.38); cursor:pointer; }
      .pswp .contest-pswp__close { position:fixed; top:calc(16px + env(safe-area-inset-top, 0px)); left:calc(16px + env(safe-area-inset-left, 0px)); width:56px; height:56px; border-radius:50%; z-index:10010; }
      .pswp .contest-pswp__close svg { width:30px; height:30px; fill:none; stroke:currentColor; stroke-width:2.4; stroke-linecap:round; }
      .pswp .contest-pswp__minimap { position:fixed; left:calc(16px + env(safe-area-inset-left, 0px)); bottom:calc(16px + env(safe-area-inset-bottom, 0px)); width:min(30vw,300px); aspect-ratio:1; overflow:hidden; border:2px solid rgba(255,255,255,.88); border-radius:9px; background:#0b0f16; box-shadow:0 4px 18px rgba(0,0,0,.48); z-index:10010; }
      .pswp .contest-pswp__minimap-image { display:block; width:100%; height:100%; object-fit:contain; background:#0b0f16; }
      .pswp .contest-pswp__minimap-viewport { position:absolute; box-sizing:border-box; border:2px solid #fff; background:rgba(59,130,246,.22); transform:translate(-50%,-50%); pointer-events:none; }
      .pswp .contest-pswp__zoom { position:fixed; display:flex; flex-direction:column; gap:10px; right:calc(16px + env(safe-area-inset-right, 0px)); bottom:calc(16px + env(safe-area-inset-bottom, 0px)); z-index:10010; }
      .pswp .contest-pswp__zoom button { width:52px; height:52px; border-radius:50%; font-size:34px; font-weight:300; line-height:1; }
      .pswp .contest-pswp__marker-layer { position:fixed; inset:0; display:none; pointer-events:none; z-index:10005; }
      .pswp .contest-pswp__marker { position:absolute; display:none; box-sizing:border-box; padding:0; border:3px solid #fff; border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 0 3px rgba(0,0,0,.34),0 4px 14px rgba(0,0,0,.45); touch-action:none; pointer-events:auto; }
      .pswp .contest-pswp__marker-confirm { position:absolute; display:none; align-items:center; justify-content:center; box-sizing:border-box; width:42px; height:42px; padding:0; border:0; border-radius:50%; color:#fff; background:#16a34a; box-shadow:0 4px 14px rgba(0,0,0,.45); transform:translate(-50%, calc(-100% - 12px)); cursor:pointer; pointer-events:auto; }
      .pswp .contest-pswp__marker-confirm svg { width:25px; height:25px; fill:none; stroke:currentColor; stroke-width:2.8; stroke-linecap:round; stroke-linejoin:round; }
      @media (max-width:640px) { .pswp .contest-pswp__close { top:calc(12px + env(safe-area-inset-top, 0px)); left:calc(12px + env(safe-area-inset-left, 0px)); width:50px; height:50px; } .pswp .contest-pswp__minimap { left:calc(12px + env(safe-area-inset-left, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); width:min(30vw,180px); } .pswp .contest-pswp__zoom { right:calc(12px + env(safe-area-inset-right, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); } .pswp .contest-pswp__zoom button { width:46px; height:46px; font-size:30px; } }
    `}</style>
  );
}