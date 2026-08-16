/**
 * components/admin/BlockToolbar.tsx — панель инструментов конструктора.
 * Список типов блоков, которые можно добавить на холст.
 */

'use client';

import type { BlockType } from '@/types';

interface Props {
  onAdd: (type: BlockType) => void;
}

/** Доступные типы блоков с иконками (эмодзи для простоты). */
const BLOCK_TYPES: { type: BlockType; label: string; icon: string; desc: string }[] = [
  { type: 'TextBlock', label: 'Текст', icon: '📝', desc: 'Markdown-текст условия' },
  { type: 'ImageBlock', label: 'Картинка', icon: '🖼️', desc: 'Изображение' },
  { type: 'InputField', label: 'Поле ввода', icon: '⌨️', desc: 'Текстовый ответ' },
  { type: 'Button', label: 'Кнопка', icon: '🔘', desc: 'Отправить ответ' },
  { type: 'DragZone', label: 'Зона DnD', icon: '📦', desc: 'Корзина для объектов' },
  { type: 'DragObject', label: 'Объект DnD', icon: '🎯', desc: 'Перетаскиваемый элемент' },
];

export function BlockToolbar({ onAdd }: Props) {
  return (
    <div className="card-surface">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Инструменты
      </h3>
      <div className="flex flex-col gap-2">
        {BLOCK_TYPES.map((b) => (
          <button
            key={b.type}
            onClick={() => onAdd(b.type)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent-light hover:border-accent border border-transparent transition-all duration-200 text-left"
          >
            <span className="text-2xl">{b.icon}</span>
            <div>
              <div className="text-sm font-medium text-slate-800">{b.label}</div>
              <div className="text-xs text-slate-500">{b.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
