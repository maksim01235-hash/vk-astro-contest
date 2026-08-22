'use client';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
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
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(blocks, oldIndex, newIndex).map((block, index) => ({ ...block, order: index })));
  };

  return (
    <div className="card-surface min-h-[400px]">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Холст карточки</h3>
      {blocks.length === 0 ? <div className="py-12 text-center text-slate-400">Добавьте блоки из панели слева</div> : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {blocks.map((block) => <SortableBlock key={block.id} block={block} selected={selectedId === block.id} onSelect={() => onSelect(block.id)} onDelete={() => { onChange(blocks.filter((item) => item.id !== block.id).map((item, index) => ({ ...item, order: index }))); if (selectedId === block.id) onSelect(null); }} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableBlock({ block, selected, onSelect, onDelete }: { block: Block; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const summary = block.type === 'ImageBlock'
    ? `${block.images?.length || (block.src ? 1 : 0)} изображ.`
    : block.type === 'TextBlock' ? block.content?.slice(0, 50) || 'Текст'
    : block.type === 'InputField' || block.type === 'Button' || block.type === 'DragZone' ? block.label
    : block.label || 'Объект';
  const icons: Record<string, string> = { TextBlock: '📝', ImageBlock: '🖼️', InputField: '⌨️', Button: '🔘', DragZone: '📦', DragObject: '🎯' };

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={clsx('flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-all', selected ? 'border-accent bg-accent-light' : 'border-slate-200 bg-white hover:border-slate-300', isDragging && 'opacity-50 shadow-lg')} onClick={onSelect}>
      <span {...attributes} {...listeners} className="cursor-grab text-slate-400 active:cursor-grabbing" onClick={(event) => event.stopPropagation()}>⠿</span>
      <span className="text-xl">{icons[block.type]}</span>
      <span className="flex-1 truncate text-sm text-slate-700">{summary}</span>
      <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} className="text-sm text-red-400 hover:text-red-600">✕</button>
    </div>
  );
}
