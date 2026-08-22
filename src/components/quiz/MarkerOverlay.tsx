'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface MarkerPosition {
  x: number;
  y: number;
}

export interface MarkerOverlayOptions {
  color: string;
  sizePercent: number;
  minSize: number;
  maxSize: number;
}

export interface MarkerOverlayHandlers {
  onActivate?: () => void;
  onChange?: (position: MarkerPosition) => void;
  onConfirm?: () => void;
}

export interface MarkerOverlayInstance {
  mount: () => void;
  unmount: () => void;
  updatePosition: (position: MarkerPosition) => void;
  updateImage: (image: HTMLImageElement) => void;
  setActive: (active: boolean) => void;
  setConfirmed: (confirmed: boolean) => void;
}

const defaultOptions: MarkerOverlayOptions = {
  color: '#3B82F6',
  sizePercent: 5,
  minSize: 20,
  maxSize: 72,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createMarkerOverlay(
  container: HTMLElement,
  options: Partial<MarkerOverlayOptions> = {},
  handlers: MarkerOverlayHandlers = {},
): MarkerOverlayInstance {
  const opts = { ...defaultOptions, ...options };
  
  let layer: HTMLDivElement | null = null;
  let dot: HTMLButtonElement | null = null;
  let confirm: HTMLButtonElement | null = null;
  let currentImage: HTMLImageElement | null = null;
  let currentPosition: MarkerPosition | null = null;
  let isActive = false;
  let isConfirmed = false;
  let isDragging = false;
  let dragPointerId: number | null = null;

  const stopEvent = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const getPosition = () => {
    if (!currentImage) return null;
    const rect = currentImage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const syncPosition = useCallback(() => {
    if (!dot || !confirm || !currentPosition || !currentImage) return;

    const pos = getPosition();
    if (!pos) return;

    const x = pos.left + pos.width * (clamp(currentPosition.x, 0, 100) / 100);
    const y = pos.top + pos.height * (clamp(currentPosition.y, 0, 100) / 100);
    const size = clamp(Math.min(pos.width, pos.height) * (opts.sizePercent / 100), opts.minSize, opts.maxSize);

    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.backgroundColor = opts.color;
    dot.style.display = 'block';

    confirm.style.left = `${x}px`;
    confirm.style.top = `${Math.max(54, y - size / 2 - 10)}px`;
    confirm.style.display = isActive ? 'flex' : 'none';
  }, [opts.color, opts.sizePercent, opts.minSize, opts.maxSize, isActive]);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isConfirmed || !currentImage) return;

    const pos = getPosition();
    if (!pos) return;

    handlers.onChange?.({
      x: clamp(((clientX - pos.left) / pos.width) * 100, 0, 100),
      y: clamp(((clientY - pos.top) / pos.height) * 100, 0, 100),
    });
  }, [isConfirmed, handlers]);

  const stopDrag = useCallback(() => {
    isDragging = false;
    dragPointerId = null;
  }, []);

  const onDotPointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0 || isConfirmed) return;
    stopEvent(event);

    if (!isActive) {
      isActive = true;
      handlers.onActivate?.();
      syncPosition();
      return;
    }

    isDragging = true;
    dragPointerId = event.pointerId;
    dot?.setPointerCapture?.(event.pointerId);
  }, [isActive, isConfirmed, handlers, syncPosition]);

  const onConfirmPointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0 || !isActive) return;
    stopEvent(event);

    isActive = false;
    isConfirmed = true;
    stopDrag();
    handlers.onConfirm?.();
    syncPosition();
  }, [isActive, handlers, stopDrag, syncPosition]);

  const onDocumentPointerMove = useCallback((event: PointerEvent) => {
    if (!isDragging || dragPointerId !== event.pointerId) return;
    stopEvent(event);
    updateFromPointer(event.clientX, event.clientY);
  }, [updateFromPointer]);

  const onDocumentPointerEnd = useCallback((event: PointerEvent) => {
    if (!isDragging || dragPointerId !== event.pointerId) return;
    stopEvent(event);
    if (dot?.hasPointerCapture?.(event.pointerId)) {
      dot.releasePointerCapture?.(event.pointerId);
    }
    stopDrag();
  }, [stopDrag]);

  const onDocumentCapture = useCallback((event: Event) => {
    if (!isDragging) return;
    const pointerEvent = event as PointerEvent;
    if ('pointerId' in pointerEvent && pointerEvent.pointerId !== dragPointerId) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const mount = useCallback(() => {
    if (layer) return;

    layer = document.createElement('div');
    layer.className = 'contest-pswp__marker-portal';

    dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'contest-pswp__marker';
    dot.setAttribute('aria-label', 'Переместить метку');

    confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'contest-pswp__marker-confirm';
    confirm.setAttribute('aria-label', 'Зафиксировать положение метки');
    confirm.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg>';

    dot.addEventListener('pointerdown', onDotPointerDown, { passive: false });
    confirm.addEventListener('pointerdown', onConfirmPointerDown, { passive: false });

    ['click', 'dblclick', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel'].forEach((name) => {
      dot!.addEventListener(name, stopEvent, { passive: false });
      confirm!.addEventListener(name, stopEvent, { passive: false });
    });

    ['pointermove', 'pointerup', 'pointercancel'].forEach((name) => {
      document.addEventListener(name, onDocumentCapture, { capture: true, passive: false });
    });
    document.addEventListener('pointermove', onDocumentPointerMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onDocumentPointerEnd, { capture: true, passive: false });
    document.addEventListener('pointercancel', onDocumentPointerEnd, { capture: true, passive: false });

    layer.append(dot, confirm);
    container.appendChild(layer);
  }, [container, onDotPointerDown, onConfirmPointerDown, onDocumentCapture, onDocumentPointerMove, onDocumentPointerEnd]);

  const unmount = useCallback(() => {
    stopDrag();

    ['pointermove', 'pointerup', 'pointercancel'].forEach((name) => {
      document.removeEventListener(name, onDocumentCapture, { capture: true });
    });
    document.removeEventListener('pointermove', onDocumentPointerMove, { capture: true });
    document.removeEventListener('pointerup', onDocumentPointerEnd, { capture: true });
    document.removeEventListener('pointercancel', onDocumentPointerEnd, { capture: true });

    layer?.remove();
    layer = null;
    dot = null;
    confirm = null;
    currentImage = null;
  }, [stopDrag, onDocumentCapture, onDocumentPointerMove, onDocumentPointerEnd]);

  const updatePosition = useCallback((position: MarkerPosition) => {
    currentPosition = position;
    syncPosition();
  }, [syncPosition]);

  const updateImage = useCallback((image: HTMLImageElement) => {
    currentImage = image;
    syncPosition();
  }, [syncPosition]);

  const setActive = useCallback((active: boolean) => {
    isActive = active;
    syncPosition();
  }, [syncPosition]);

  const setConfirmed = useCallback((confirmed: boolean) => {
    isConfirmed = confirmed;
    if (confirmed) {
      isActive = false;
    }
    syncPosition();
  }, [syncPosition]);

  return {
    mount,
    unmount,
    updatePosition,
    updateImage,
    setActive,
    setConfirmed,
  };
}

export function MarkerOverlayStyles() {
  return (
    <style jsx global>{`
      .contest-pswp__marker-portal { position:fixed; inset:0; display:none; pointer-events:none; z-index:2147483646; }
      .contest-pswp__marker { position:fixed; display:none; box-sizing:border-box; padding:0; border:3px solid #fff; border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 0 3px rgba(0,0,0,.34),0 4px 14px rgba(0,0,0,.45); touch-action:none; pointer-events:auto; cursor:grab; }
      .contest-pswp__marker:active { cursor:grabbing; }
      .contest-pswp__marker-confirm { position:fixed; display:none; align-items:center; justify-content:center; box-sizing:border-box; width:42px; height:42px; padding:0; border:0; border-radius:50%; color:#fff; background:#16a34a; box-shadow:0 4px 14px rgba(0,0,0,.45); transform:translate(-50%, calc(-100% - 12px)); cursor:pointer; touch-action:none; pointer-events:auto; }
      .contest-pswp__marker-confirm svg { width:25px; height:25px; fill:none; stroke:currentColor; stroke-width:2.8; stroke-linecap:round; stroke-linejoin:round; }
    `}</style>
  );
}