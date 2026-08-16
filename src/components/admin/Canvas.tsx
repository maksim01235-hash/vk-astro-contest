/**
 * components/admin/Canvas.tsx — холст конструктора с перетаскиванием блоков.
 * Использует @dnd-kit/sortable для изменения порядка блоков.
 */

'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { Block } from '@/types';

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function Canvas({ blocks, onChange, selectedId, onSelect }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      const newBlocks = arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({
        ...b,
        order: i,
      }));
      onChange(newBlocks);
    }
  };

  return (
    <div className="card-surface min-h-[400px]">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Холст карточки
      </h3>
      {blocks.length === 0 ? (
        <div className="text-center text-slate-400 py-12">
          Добавьте блоки из панели слева
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  selected={selectedId === block.id}
                  onSelect={() => onSelect(block.id)}
                  onDelete={() => {
                    onChange(blocks.filter((b) => b.id !== block.id));
                    if (selectedId === block.id) onSelect(null);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

/** Отображение одного блока на холсте (с перетаскиванием). */
function SortableBlock({
  block,
  selected,
  onSelect,
  onDelete,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  /** Краткое описание блока для отображения. */
  const blockSummary: Record<string, () => string> = {
    TextBlock: () => (block as Extract<Block, { type: 'TextBlock' }>).content?.slice(0, 50) || 'Текст',
    ImageBlock: () => (block as Extract<Block, { type: 'ImageBlock' }>).src?.slice(0, 40) || 'Картинка',
    InputField: () => (block as Extract<Block, { type: 'InputField' }>).label || 'Поле ввода',
    Button: () => (block as Extract<Block, { type: 'Button' }>).label || 'Кнопка',
    DragZone: () => (block as Extract<Block, { type: 'DragZone' }>).label || 'Зона',
    DragObject: () => (block as Extract<Block, { type: 'DragObject' }>).label || 'Объект',
  };

  const icons: Record<string, string> = {
    TextBlock: '📝',
    ImageBlock: '🖼️',
    InputField: '⌨️',
    Button: '🔘',
    DragZone: '📦',
    DragObject: '🎯',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all duration-200',
        selected ? 'border-accent bg-accent-light' : 'border-slate-200 bg-white hover:border-slate-300',
        isDragging && 'opacity-50 shadow-lg',
      )}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </span>
      <span className="text-xl">{icons[block.type]}</span>
      <span className="flex-1 text-sm text-slate-700 truncate">
        {blockSummary[block.type]?.() || block.type}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="text-red-400 hover:text-red-600 text-sm"
      >
        ✕
      </button>
    </div>
  );
}
