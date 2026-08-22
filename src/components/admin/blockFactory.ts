import type { Block, BlockType } from '@/types';
import { genId } from '@/utils/json';

export function createBlock(type: BlockType, order: number): Block {
  const id = genId();

  switch (type) {
    case 'TextBlock':
      return { id, type, order, content: '## Новый текст\nВведите содержание (поддержка Markdown).' };
    case 'ImageBlock':
      return {
        id,
        type,
        order,
        images: [{ id: genId(), src: 'https://via.placeholder.com/600x400', alt: '' }],
        width: 'full',
        layoutMode: 'flow',
        gridColumns: 2,
        viewer: true,
      };
    case 'InputField':
      return {
        id,
        type,
        order,
        label: 'Ваш ответ',
        placeholder: 'Введите ответ',
        inputType: 'text',
        required: false,
        answerKey: 'answer',
      };
    case 'Button':
      return { id, type, order, label: 'Отправить ответ', action: 'submit', variant: 'primary' };
    case 'DragZone':
      return {
        id,
        type,
        order,
        zoneId: `zone_${Date.now()}`,
        label: 'Новая зона',
        maxItems: 0,
        layoutMode: 'flow',
        gridColumns: 2,
      };
    case 'DragObject':
      return {
        id,
        type,
        order,
        objectId: `obj_${Date.now()}`,
        label: 'Новый объект',
        allowedZones: [],
        layoutMode: 'flow',
        gridColumns: 2,
      };
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}
