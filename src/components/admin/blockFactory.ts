/**
 * src/components/admin/blockFactory.ts — фабрика для создания блоков.
 *
 * Обновления (август 2026):
 *  - ImageBlock: поддержка images[], layoutMode, gridColumns.
 *  - ImageMarkerBlock: новый тип блока.
 */

import type { Block, BlockType } from '@/types';

export function createBlock(type: BlockType, order: number): Block {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  switch (type) {
    case 'TextBlock':
      return {
        id,
        type: 'TextBlock',
        order,
        content: '',
      };

    case 'ImageBlock':
      return {
        id,
        type: 'ImageBlock',
        order,
        src: '',
        alt: '',
        width: 'full',
        maxImageWidth: undefined,
        maxImageHeight: undefined,
        viewer: true,
        images: undefined,
        layoutMode: 'flex',
        gridColumns: 3,
      };

    case 'InputField':
      return {
        id,
        type: 'InputField',
        order,
        label: '',
        placeholder: '',
        inputType: 'text',
        required: false,
        answerKey: `answer_${id}`,
      };

    case 'Button':
      return {
        id,
        type: 'Button',
        order,
        label: 'Отправить',
        action: 'submit',
        variant: 'primary',
      };

    case 'DragZone':
      return {
        id,
        type: 'DragZone',
        order,
        zoneId: `zone_${id}`,
        label: 'Зона',
        maxItems: undefined,
      };

    case 'DragObject':
      return {
        id,
        type: 'DragObject',
        order,
        objectId: `obj_${id}`,
        label: '',
        textPosition: 'left',
        allowedZones: [],
        image: '',
        maxImageSize: undefined,
        imageSize: undefined,
      };

    case 'ImageMarkerBlock':
      return {
        id,
        type: 'ImageMarkerBlock',
        order,
        src: '',
        alt: '',
        maxImageWidth: undefined,
        maxImageHeight: undefined,
        viewer: true,
        correctX: 50,
        correctY: 50,
        errorPercent: 10,
        markerColor: '#3B82F6',
        markerSizePercent: 5,
      };

    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}