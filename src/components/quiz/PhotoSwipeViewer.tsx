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
  /** Показывать в фуллскрине бейдж с текущими координатами метки (режим админа). */
  showMarkerCoords?: boolean;
  /** Отключить горизонтальное пролистывание/зацикливание (для одиночных маркерных фото). */
  disableSwipe?: boolean;
  /** Перемещение метки сразу при перетаскивании, без клика-активации. */
  immediateDrag?: boolean;
}

type Dimensions = Record<string, { width: number; height: number }>;

type PswpSlide = {
  data: { src?: string; width?: number; height?: number };
  currZoomLevel: number;
  pan: { x: number; y: number };
  /** Холдер (.pswp__item), в который сейчас вставлен слайд. */
  holderElement?: HTMLElement | null;
  zoomTo: (level: number, centerPoint?: { x: number; y: number }, transitionDuration?: number | false) => void;
};

type PswpCore = {
  currIndex: number;
  currSlide?: PswpSlide;
  viewportSize: { x: number; y: number };
  /**
   * Холдеров слайдов ровно три, они циклически переиспользуются;
   * активный слайд всегда находится в itemHolders[1]
   * (в исходниках v5: «Slide in the 2nd holder is always active»).
   */
  mainScroll?: {
    itemHolders?: Array<{ el: HTMLElement; slide?: PswpSlide }>;
  };
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
  on: (name: string, callback: (payload?: unknown) => void) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Шаг кнопок +/− относительно текущего уровня зума. */
const ZOOM_STEP = 1.5;

/**
 * Активный слайд: DOM-элемент картинки и её экранная рамка.
 *
 * ВАЖНО: холдеров слайдов (.pswp__item) в v5 ровно три, они циклически
 * переиспользуются, и активный слайд ВСЕГДА находится во втором холдере
 * (itemHolders[1]; в исходниках: «Slide in the 2nd holder is always active»).
 * Поиск по индексу слайда (children[currIndex]) недопустим — он попадает
 * в скрытый/пустой холдер.
 *
 * Прямое измерение через getBoundingClientRect — единственный источник,
 * корректный во время анимаций зума, при колесе мыши и жестах.
 */
function getActiveImageRect(pswp: PswpCore | null): { rect: DOMRect; img: HTMLElement } | null {
  if (!pswp) return null;

  const holder =
    pswp.currSlide?.holderElement
    ?? pswp.mainScroll?.itemHolders?.[1]?.el
    // Фолбэк по DOM: средний холдер всегда активен (индекс 1, не currIndex!).
    ?? (document.querySelectorAll('.pswp__item')[1] as HTMLElement | undefined);

  const img = holder?.querySelector<HTMLElement>('.pswp__img');
  if (!img) return null;

  const rect = img.getBoundingClientRect();
  // Слайд ещё не отрисован — считаем неготовым, чтобы не мигать пустыми координатами.
  if (!rect.width && !rect.height) return null;

  return { rect, img };
}

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
  showMarkerCoords = false,
  disableSwipe = false,
  immediateDrag = false,
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
  /** Базовый (fit) уровень зума активного слайда — пол для кнопки «−». */
  const baselineZoomRef = useRef(1);
  const [ready, setReady] = useState(false);

  // Свежие колбэки и пропсы в рефах: пересоздание стрелок родителем (например, при
  // обновлении состояния на каждый pointermove) не должно пересоздавать лайтбокс.
  const onCloseRef = useRef(onClose);
  const onMarkerChangeRef = useRef(onMarkerChange);
  const showMarkerCoordsRef = useRef(showMarkerCoords);
  const disableSwipeRef = useRef(disableSwipe);
  const immediateDragRef = useRef(immediateDrag);

  markerRef.current = marker;
  onCloseRef.current = onClose;
  onMarkerChangeRef.current = onMarkerChange;
  showMarkerCoordsRef.current = showMarkerCoords;
  disableSwipeRef.current = disableSwipe;
  immediateDragRef.current = immediateDrag;

  /**
   * Обновляет бейдж координат метки в фуллскрине (режим админа).
   * Позиция без аргумента — текущая из markerRef (кадр синхронизации),
   * с аргументом — только что вычисленная при перетаскивании.
   */
  const updateCoordsBadge = useCallback((position?: MarkerPosition) => {
    const pos = position ?? markerRef.current;
    if (!pos) return;
    const badge = document.querySelector<HTMLElement>('.contest-pswp__marker-coords');
    if (!badge) return;
    badge.textContent = `X: ${Math.round(pos.x)}%, Y: ${Math.round(pos.y)}%`;
  }, []);
  /**
   * Рамка видимой области на миникарте считается из экранных прямоугольников
   * активной картинки и области просмотра — точна в любой момент анимации.
   * Контейнер миникарты получает пропорции самой картинки (а не квадрат),
   * поэтому рамка не искажается. При полном обзоре (zoom ≈ fit/1x) миникарта
   * скрывается за ненадобностью.
   */
  const syncMinimap = useCallback(() => {
    const pswp = pswpRef.current;
    if (!pswp) return;

    const root = document.querySelector<HTMLElement>('.pswp');
    const minimap = root?.querySelector<HTMLElement>('.contest-pswp__minimap');
    const minimapImage = root?.querySelector<HTMLImageElement>('.contest-pswp__minimap-image');
    const viewport = root?.querySelector<HTMLElement>('.contest-pswp__minimap-viewport');
    const current = images[pswp.currIndex];
    if (!root || !minimap || !minimapImage || !viewport || !current) return;

    const found = getActiveImageRect(pswp);
    if (!found) return;

    const vr = root.getBoundingClientRect();
    const r = found.rect;
    const fullyVisible =
      r.width <= vr.width + 0.5 &&
      r.height <= vr.height + 0.5 &&
      r.left >= vr.left - 0.5 &&
      r.top >= vr.top - 0.5;
    minimap.style.display = fullyVisible ? 'none' : 'block';
    if (fullyVisible) return;

    minimap.style.aspectRatio = `${Math.max(r.width, 1)} / ${Math.max(r.height, 1)}`;
    if (minimapImage.src !== current.src) minimapImage.src = current.src;

    const visibleLeftPct = clamp(((vr.left - r.left) / r.width) * 100, 0, 100);
    const visibleTopPct = clamp(((vr.top - r.top) / r.height) * 100, 0, 100);
    const visibleWidthPct = clamp(((vr.right - r.left) / r.width) * 100, 0, 100) - visibleLeftPct;
    const visibleHeightPct = clamp(((vr.bottom - r.top) / r.height) * 100, 0, 100) - visibleTopPct;

    // CSS у viewport: translate(-50%,-50%) — задаём центр рамки.
    viewport.style.width = `${visibleWidthPct}%`;
    viewport.style.height = `${visibleHeightPct}%`;
    viewport.style.left = `${visibleLeftPct + visibleWidthPct / 2}%`;
    viewport.style.top = `${visibleTopPct + visibleHeightPct / 2}%`;
  }, [images]);

  const syncMarker = useCallback(() => {
    const position = markerRef.current;
    const found = getActiveImageRect(pswpRef.current);
    if (!position || !found) return;

    const dot = document.querySelector<HTMLElement>('.contest-pswp__marker');
    if (!dot) return;

    // Позиция из экранной рамки активной картинки — метка «приклеена» к точке
    // фото и плавно следует анимации зума (кнопки, колесо, щипок).
    const { rect } = found;
    const markerX = rect.left + rect.width * (position.x / 100);
    const markerY = rect.top + rect.height * (position.y / 100);
    const size = Math.max(20, Math.min(72, Math.min(rect.width, rect.height) * (markerSizePercent / 100)));

    dot.style.left = `${markerX}px`;
    dot.style.top = `${markerY}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.backgroundColor = markerColor;
    dot.style.display = 'block';

    updateCoordsBadge(position);
  }, [markerColor, markerSizePercent, updateCoordsBadge]);

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
    if (!draggingRef.current || !markerRef.current) return;

    const found = getActiveImageRect(pswpRef.current);
    if (!found) return;

    const next = {
      x: clamp(((clientX - found.rect.left) / found.rect.width) * 100, 0, 100),
      y: clamp(((clientY - found.rect.top) / found.rect.height) * 100, 0, 100),
    };

    // Экранная позиция известна точно — двигаем точку сразу,
    // не дожидаясь перерендера родителя и следующего кадра синхронизации.
    const dot = document.querySelector<HTMLElement>('.contest-pswp__marker');
    if (dot) {
      dot.style.left = `${clientX}px`;
      dot.style.top = `${clientY}px`;
    }

    updateCoordsBadge(next);
    onMarkerChangeRef.current?.(next);
  }, [updateCoordsBadge]);

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
      // Для одиночных маркерных фото запрещаем зацикленное пролистывание и
      // перелистывание при панорамировании (семантика; жестовый драг контейнера
      // дополнительно блокируется обёрткой mainScroll.moveTo выше).
      loop: !disableSwipe,
      allowPanToNext: !disableSwipe,
      arrowKeys: images.length > 1 && !disableSwipe,
    });

    lightbox.on('uiRegister', () => {
      const pswp = lightbox.pswp as unknown as PswpCore;
      pswpRef.current = pswp;

      /** Запомнить базовый (fit) уровень зума текущего слайда. */
      const captureBaseline = () => {
        baselineZoomRef.current = pswp.currSlide?.currZoomLevel || 1;
      };
      requestAnimationFrame(captureBaseline);

      /**
       * Жёсткое отключение жестового горизонтального пролистывания для одиночных
       * маркерных фото. На fit-зуме DragHandler двигает контейнер напрямую —
       * mainScroll.moveTo(x, dragging=true), минуя опции loop/allowPanToNext.
       * Блокируем только жестовые вызовы (dragging === true); программные
       * анимации слайдов не трогаем. Панорамирование при зуме идёт через
       * slide.pan и остаётся доступным.
       */
      if (disableSwipeRef.current) {
        const mainScroll = pswp.mainScroll as {
          moveTo?: (x: number, dragging?: boolean) => void;
        } | undefined;

        if (mainScroll && typeof mainScroll.moveTo === 'function') {
          const originalMoveTo = mainScroll.moveTo.bind(mainScroll);
          mainScroll.moveTo = (x, dragging) => {
            if (dragging === true) return;
            originalMoveTo(x, dragging);
          };
        }
      }

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
          const center = () => ({ x: instance.viewportSize.x / 2, y: instance.viewportSize.y / 2 });
          // Плавный шаг вверх; потолок — 8x от базового (fit) уровня слайда.
          element.querySelector<HTMLButtonElement>('.contest-pswp__zoom-in')?.addEventListener('click', () => {
            const slide = instance.currSlide;
            if (!slide) return;
            slide.zoomTo(Math.min(slide.currZoomLevel * ZOOM_STEP, baselineZoomRef.current * 8), center(), 250);
          });
          // Плавный шаг вниз; пол — базовый уровень (картинка целиком видна).
          element.querySelector<HTMLButtonElement>('.contest-pswp__zoom-out')?.addEventListener('click', () => {
            const slide = instance.currSlide;
            if (!slide) return;
            slide.zoomTo(Math.max(slide.currZoomLevel / ZOOM_STEP, baselineZoomRef.current), center(), 250);
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
            // Клик-активация окна перемещения — только в кликовом режиме
            // (в режиме мгновенного перетаскивания метка тянется сразу).
            element.addEventListener('click', (event) => {
              event.stopPropagation();
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (!markerRef.current || draggingRef.current) return;
              if (immediateDragRef.current) return;
              armMarker();
            });
            // Начало перетаскивания: мгновенно либо в активном окне (после тапа).
            element.addEventListener('pointerdown', (event) => {
              if (!markerRef.current || draggingRef.current) return;
              if (!immediateDragRef.current && !armedRef.current) return;
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

        if (showMarkerCoordsRef.current) {
          const initial = markerRef.current;
          pswp.ui.registerElement({
            name: 'contest-marker-coords',
            order: 6,
            tagName: 'div',
            className: 'contest-pswp__marker-coords',
            appendTo: 'root',
            html: initial ? `X: ${Math.round(initial.x)}%, Y: ${Math.round(initial.y)}%` : '',
          });
        }
      }

      pswp.on('change', () => { disarmMarker(); draggingRef.current = false; captureBaseline(); });
      // Базовый (fit) уровень зума — обновляется при загрузке слайда и переключении.
      pswp.on('loadComplete', (payload) => {
        const slide = (payload as { slide?: PswpSlide } | undefined)?.slide;
        if (slide) baselineZoomRef.current = slide.currZoomLevel || 1;
      });

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
  }, [applyMarkerVisual, armMarker, disableSwipe, disarmMarker, images, initialIndex, moveMarkerFromPointer, open, ready, syncMarker, syncMinimap]);

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
      .pswp .contest-pswp__minimap { display:none; position:fixed; left:calc(16px + env(safe-area-inset-left, 0px)); bottom:calc(16px + env(safe-area-inset-bottom, 0px)); width:min(22vw,220px); overflow:hidden; border:2px solid rgba(255,255,255,.88); border-radius:9px; background:#0b0f16; box-shadow:0 4px 18px rgba(0,0,0,.48); z-index:10010; }
      .pswp .contest-pswp__minimap-image { display:block; width:100%; height:100%; object-fit:contain; background:#0b0f16; }
      .pswp .contest-pswp__minimap-viewport { position:absolute; box-sizing:border-box; border:2px solid #fff; background:rgba(59,130,246,.22); transform:translate(-50%,-50%); pointer-events:none; }
      .pswp .contest-pswp__zoom { position:fixed; display:flex; flex-direction:column; gap:10px; right:calc(16px + env(safe-area-inset-right, 0px)); bottom:calc(16px + env(safe-area-inset-bottom, 0px)); z-index:10010; }
      .pswp .contest-pswp__zoom button { width:52px; height:52px; border-radius:50%; font-size:34px; font-weight:300; line-height:1; }
      .pswp .contest-pswp__marker { position:absolute; display:none; box-sizing:border-box; border:3px solid #fff; border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 0 3px rgba(0,0,0,.34),0 4px 14px rgba(0,0,0,.45); cursor:pointer; touch-action:none; z-index:10011; }
      .pswp .contest-pswp__marker--armed { animation: contest-marker-pulse 1s ease-in-out infinite; }
      .pswp .contest-pswp__marker--dragging { animation:none; }
      @keyframes contest-marker-pulse { 0%,100% { box-shadow:0 0 0 3px rgba(59,130,246,.65),0 4px 14px rgba(0,0,0,.45); } 50% { box-shadow:0 0 0 14px rgba(59,130,246,0),0 4px 14px rgba(0,0,0,.45); } }
      .pswp .contest-pswp__marker-hint { display:none; position:fixed; top:calc(20px + env(safe-area-inset-top, 0px)); left:50%; transform:translateX(-50%); padding:8px 16px; border-radius:999px; background:rgba(7,12,20,.78); color:#fff; font-size:13px; white-space:nowrap; pointer-events:none; z-index:10012; }
      .pswp .contest-pswp__marker-coords { position:fixed; top:calc(20px + env(safe-area-inset-top, 0px)); right:calc(16px + env(safe-area-inset-right, 0px)); padding:8px 14px; border-radius:999px; background:rgba(7,12,20,.78); color:#fff; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; white-space:nowrap; pointer-events:none; z-index:10012; }
      @media (max-width:640px) { .pswp .contest-pswp__close { top:calc(12px + env(safe-area-inset-top, 0px)); left:calc(12px + env(safe-area-inset-left, 0px)); width:50px; height:50px; } .pswp .contest-pswp__minimap { left:calc(12px + env(safe-area-inset-left, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); width:min(22vw,140px); } .pswp .contest-pswp__zoom { right:calc(12px + env(safe-area-inset-right, 0px)); bottom:calc(12px + env(safe-area-inset-bottom, 0px)); } .pswp .contest-pswp__zoom button { width:46px; height:46px; font-size:30px; } }
    `}</style>
  );
}
