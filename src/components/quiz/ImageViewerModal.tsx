/**
 * components/quiz/ImageViewerModal.tsx — полноэкранный просмотр картинки с зумом/панорамированием.
 *
 * ВАЖНО: путь создания — vk-contest-mini-app/src/components/quiz/ImageViewerModal.tsx
 * Это НОВЫЙ файл, который раньше не существовал в проекте. Он должен лежать
 * РЯДОМ с папкой blocks/ (то есть в src/components/quiz/, а не внутри blocks/).
 *
 * Проверка структуры после создания:
 * src/components/quiz/
 *   ├── ImageViewerModal.tsx   <-- этот файл
 *   ├── DnDContainer.tsx
 *   ├── CardRenderer.tsx
 *   └── blocks/
 *       └── ImageBlock.tsx     <-- импортирует '../ImageViewerModal'
 *
 * Требует установленную зависимость: npm install yet-another-react-lightbox
 */

'use client';

import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

interface Props {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export function ImageViewerModal({ open, onClose, src, alt }: Props) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={[{ src, alt: alt || '' }]}
      plugins={[Zoom]}
      zoom={{
        maxZoomPixelRatio: 4,
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        doubleClickDelay: 300,
        doubleClickMaxStops: 2,
        keyboardMoveDistance: 50,
        wheelZoomDistanceFactor: 100,
        pinchZoomDistanceFactor: 100,
        scrollToZoom: true,
      }}
      carousel={{ finite: true }}
      render={{
        buttonPrev: () => null,
        buttonNext: () => null,
      }}
    />
  );
}