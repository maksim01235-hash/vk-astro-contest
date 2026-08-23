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

/** Окно в миллисекундах, когда после тапа можно начать перетаскивание метки. */
const ARM_WINDOW_MS = 3000;

interface Props {
  open: boolean;
  images: PhotoSwipeImage[];
  initialIndex?: number;
  onClose: () => void;
  /** Позиция метки в процентах 0–100 относительно исходной картинки. Без неё метка не рендерится. */
  marker?: MarkerPosition;
  markerColor?: string;
  markerSizePercent?: number;
  /** Вызывается на каждое перемещение метки во время перетаскивания. */
  onMarkerChange?: (position: MarkerPosition) => void;
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
      /** Куда монтировать элемент; по умолчанию — top-bar, 'root' — в корень .pswp. */
      appendTo?: string;
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
  onMarkerChange,
}: Props) {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);
  const pswpRef = useRef<PswpCore | null>(null);
  const dimensionsRef = useRef<Dimensions>({});
  const markerRef = useRef(marker);
  const draggingRef = useRef(false);
  const armedRef = useRef(false);
  const armTimerRef = useRef<number | null>(null);
  const syncRafRef = useRef<number | null>(null);
  // После перетаскивания приходит click — подавляем его, чтобы не разармировать метку.
  const suppressClickRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Свежие колбэки в рефах: пересоздание стрелок родителем (например, при
  // обновлении состояния на каждый pointermove) не должно пересоздавать лайтбокс.
  const onCloseRef = useRef(onClose);
  const onMarkerChangeRef = useRef(onMarkerChange);

  markerRef.current = marker;
  onCloseRef.current = onClose;
  onMarkerChangeRef.current = onMarkerChange;

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
  }, [markerColor, markerSizePercent]);

  /** Визуальное состояние метки: классы активности и видимость подсказки. */
  const applyMarkerVisual = useCallback(() => {
    const root = document.querySelector('.pswp');
    const dot = root?.querySelector<HTMLElement>('.contest-pswp__marker');
    const hint = root?.querySelector<HTMLElement>('.contest-pswp__marker-hint');
    const active = armedRef.current && !draggingRef.current;
    dot?.classList.toggle('contest-pswp__marker--armed', active);
    if (hint) hint.style.display = active ? 'block' : 'none';
  }, []);

  /**
   * Разблокировать метку на ARM_WINDOW_MS: за это время нужно начать
   * перетаскивание (защита от случайных одиночных касаний).
   */
  const armMarker = useCallback(() => {
    armedRef.current = true;
    if (armTimerRef.current !== null) window.clearTimeout(armTimerRef.current);
    armTimerRef.current = window.setTimeout(() => {
      armedRef.current = false;
      armTimerRef.current = null;
      applyMarkerVisual();
    }, ARM_WINDOW_MS);
    applyMarkerVisual();
  }, [applyMarkerVisual]);

  /** Зафиксировать метку: снять активность и отменить окно перемещения. */
  const disarmMarker = useCallback(() => {
    armedRef.current = false;
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    applyMarkerVisual();
  }, [applyMarkerVisual]);

  const moveMarkerFromPointer = useCallback((clientX: number, clientY: number) => {
    const pswp = pswpRef.current;
    if (!pswp?.currSlide || !markerRef.current || !draggingRef.current) return;

    const slide = pswp.currSlide;
    const zoom = slide.currZoomLevel || 1;
    const width = slide.data.width || 1;
    const height = slide.data.height || 1;
    const next = {
      x: clamp(((clientX - slide.pan.x) / (width * zoom)) * 100, 0, 100),
      y: clamp(((clientY - slide.pan.y) / (height * zoom)) * 100, 0, 100),
    };

    // Экранная позиция известна точно — двигаем точку сразу,
    // не дожидаясь перерендера родителя и следующего zoomPanUpdate.
    const dot = document.querySelector<HTMLElement>('.contest-pswp__marker');
    if (dot) {
      dot.style.left = `${clientX}px`;
      dot.style.top = `${clientY}px`;
    }

    onMarkerChangeRef.current?.(next);
  }, []);

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

      if (markerRef.current) {
        pswp.ui.registerElement({
          name: 'contest-marker',
          order: 4,
          tagName: 'div',
          className: 'contest-pswp__marker',
          // Обязательно в корень: top-bar у нас прибит к низу экрана,
          // абсолютные координаты метки должны считаться от viewport.
          appendTo: 'root',
          onInit: (element) => {
            // Первый тап — окно перемещения (защита от случайных касаний).
            element.addEventListener('click', (event) => {
              event.stopPropagation();
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (!markerRef.current || draggingRef.current) return;
              armMarker();
            });
            // Начало перетаскивания доступно только в активном окне.
            element.addEventListener('pointerdown', (event) => {
              if (!armedRef.current || draggingRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              draggingRef.current = true;
              if (armTimerRef.current !== null) {
                window.clearTimeout(armTimerRef.current);
                armTimerRef.current = null;
              }
              element.setPointerCapture?.(event.pointerId);
              element.classList.add('contest-pswp__marker--dragging');
              applyMarkerVisual();
            });
            element.addEventListener('pointermove', (event) => moveMarkerFromPointer(event.clientX, event.clientY));
            // Отпускание пальца фиксирует позицию.
            const endDrag = () => {
              if (!draggingRef.current) return;
              draggingRef.current = false;
              suppressClickRef.current = true;
              element.classList.remove('contest-pswp__marker--dragging');
              disarmMarker();
            };
            element.addEventListener('pointerup', endDrag);
            element.addEventListener('pointercancel', endDrag);
          },
        });

        pswp.ui.registerElement({
          name: 'contest-marker-hint',
          order: 5,
          tagName: 'div',
          className: 'contest-pswp__marker-hint',
          appendTo: 'root',
          html: 'Перетащите метку',
        });
      }

      pswp.on('change', () => { disarmMarker(); draggingRef.current = false; });

      /**
       * Непрерывная синхронизация, пока просмотр открыт: покрывает зум колесом,
       * жесты, ресайз и позднюю загрузку натуральных размеров картинки.
       * Во время активного перетаскивания позицию точки ведёт палец напрямую —
       * пропускаем syncMarker, чтобы не было джиттера из-за лага состояния.
       */
      applyMarkerVisual();
      const tick = () => {
        syncMinimap();
        if (!draggingRef.current) syncMarker();
        syncRafRef.current = requestAnimationFrame(tick);
      };
      syncRafRef.current = requestAnimationFrame(tick);
    });

    const stopSyncLoop = () => {
      if (syncRafRef.current !== null) {
        cancelAnimationFrame(syncRafRef.current);
        syncRafRef.current = null;
      }
    };

    lightbox.on('destroy', () => {
      stopSyncLoop();
      pswpRef.current = null;
      lightboxRef.current = null;
      setReady(false);
      onCloseRef.current();
    });

    lightbox.init();
    lightboxRef.current = lightbox;
    lightbox.loadAndOpen(Math.max(0, Math.min(initialIndex, images.length - 1)));

    return () => {
      stopSyncLoop();
      lightbox.destroy();
      lightboxRef.current = null;
      pswpRef.current = null;
      draggingRef.current = false;
      disarmMarker();
    };
  }, [applyMarkerVisual, armMarker, disarmMarker, images, initialIndex, moveMarkerFromPointer, open, ready, syncMarker, syncMinimap]);

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
      .pswp .contest-pswp__marker { position:absolute; display:none; box-sizing:border-box; border:3px solid #fff; border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 0 3px rgba(0,0,0,.34),0 4px 14px rgba(0,0,0,.45); cursor:pointer; touch-action:none; z-index:10011; }
      .pswp .contest-pswp__marker--armed { animation: contest-marker-pulse 1s ease-in-out infinite; }
      .pswp .contest-pswp__marker--dragging { animation:none; }
      @keyframes contest-marker-pulse { 0%,100% { box-shadow:0 0 0 3px rgba(59,130,246,.65),0 4px 14px rgba(0,0,0,.45); } 50% { box-shadow:0 0 0 14px rgba(59,130,246,0),0 4px 14px rgba(0,0,0,.45); } }
      .pswp .contest-pswp__marker-hint { display:none; position:fixed; top:calc(20px + env(safe-area-inset-top, 0px)); left:50%; transform:translateX(-50%); padding:8px 16px; border-radius:999px; background:rgba(7,12,20,.78); color:#fff; font-size:13px; white-space:nowrap; pointer-events:none; z-index:10012; }
      @media (max-width:640px) { .pswp .contest-pswp__close { top:calc(12px + env(safe-area-inset-top, 0px)); left:calc(12px + env(safe-area-inset-left, 0px)); width:50px; height:50px; } .pswp .contest-pswp__minimap { left:calc(12px + env(safe-area-inset-left, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); width:min(30vw,180px); } .pswp .contest-pswp__zoom { right:calc(12px + env(safe-area-inset-right, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); } .pswp .contest-pswp__zoom button { width:46px; height:46px; font-size:30px; } }
    `}</style>
  );
}
