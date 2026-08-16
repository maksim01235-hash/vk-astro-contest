/**
 * components/admin/blockFactory.ts — создание новых блоков по типу.
 * Генерирует блок с дефолтными значениями и уникальным ID.
 */

import type { Block, BlockType } from '@/types';
import { genId } from '@/utils/json';

/**
 * Создаёт новый блок указанного типа с дефолтными значениями.
 * @param type — тип блока
 * @param order — порядковый номер на холсте
 */
export function createBlock(type: BlockType, order: number): Block {
  const id = genId();
  switch (type) {
    case 'TextBlock':
      return {
        id,
        type,
        order,
        content: '## Новый текст\nВведите содержание (поддержка Markdown).',
      };
    case 'ImageBlock':
      return {
        id,
        type,
        order,
        src: 'https://via.placeholder.com/600x400',
        alt: '',
        width: 'full',
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
      return {
        id,
        type,
        order,
        label: 'Отправить ответ',
        action: 'submit',
        variant: 'primary',
      };
    case 'DragZone':
      return {
        id,
        type,
        order,
        zoneId: `zone_${Date.now()}`,
        label: 'Новая зона',
        maxItems: 0,
      };
    case 'DragObject':
      return {
        id,
        type,
        order,
        objectId: `obj_${Date.now()}`,
        label: 'Новый объект',
        allowedZones: [],
      };
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}
