/**
 * src/components/admin/BlockToolbar.tsx — панель инструментов для добавления блоков.
 *
 * Обновления (август 2026):
 *  - Добавлен ImageMarkerBlock.
 */

'use client';

import type { BlockType } from '@/types';

interface Props {
  onAdd: (type: BlockType) => void;
}

export function BlockToolbar({ onAdd }: Props) {
  const tools: Array<{ type: BlockType; label: string; icon: string }> = [
    { type: 'TextBlock', label: 'Текст', icon: '📝' },
    { type: 'ImageBlock', label: 'Изображение', icon: '🖼️' },
    { type: 'InputField', label: 'Поле ввода', icon: '📝' },
    { type: 'Button', label: 'Кнопка', icon: '🔘' },
    { type: 'DragZone', label: 'Зона DnD', icon: '📦' },
    { type: 'DragObject', label: 'Объект DnD', icon: '🎯' },
    { type: 'ImageMarkerBlock', label: 'Изображение с маркером', icon: '🎯' },
  ];

  return (
    <div className="card-surface p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Инструменты</h3>
      <div className="flex flex-col gap-2">
        {tools.map((tool) => (
          <button
            key={tool.type}
            className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            onClick={() => onAdd(tool.type)}
          >
            <span className="text-xl">{tool.icon}</span>
            <span className="text-sm font-medium text-slate-700">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}