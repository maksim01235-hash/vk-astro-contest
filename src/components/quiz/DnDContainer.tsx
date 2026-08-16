/**
 * components/quiz/DnDContainer.tsx — контейнер drag-and-drop через @dnd-kit.
 *
 * Логика:
 *  - DragZone — слоты (корзины), куда перетаскивают объекты.
 *  - DragObject — объекты, которые перетаскивают.
 *  - Каждый DragObject имеет allowedZones (массив zoneId).
 *  - При перетаскивании проверяется, разрешена ли зона.
 *  - Состояние DnD: { zoneId: [objectId, ...] }.
 *  - Анимации: подсветка допустимых зон, плавное перемещение.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { Block, DnDState } from '@/types';
import { logEvent } from '@/lib/sheets/logger';
import clsx from 'clsx';

interface DnDContainerProps {
  blocks: Block[];
  onStateChange: (state: DnDState) => void;
}

export function DnDContainer({ blocks, onStateChange }: DnDContainerProps) {
  const zones = blocks.filter((b): b is Extract<Block, { type: 'DragZone' }> => b.type === 'DragZone');
  const objects = blocks.filter((b): b is Extract<Block, { type: 'DragObject' }> => b.type === 'DragObject');

  // Состояние: { zoneId: [objectId, ...] }. Объекты без зоны — в "unassigned".
  const [state, setState] = useState<DnDState>({ unassigned: objects.map((o) => o.objectId) });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Сенсоры: мышь, тач, клавиатура (для доступности).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // Уведомляем родителя об изменении состояния.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
    onStateChange(state);
  }, [state, onStateChange]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    logEvent('dnd_change', { action: 'drag_start', objectId: String(event.active.id) });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const objectId = String(active.id);
      const targetZoneId = over ? String(over.id) : 'unassigned';
      setActiveId(null);

      // Проверяем, разрешена ли зона для этого объекта.
      const obj = objects.find((o) => o.objectId === objectId);
      if (!obj) return;

      if (targetZoneId !== 'unassigned' && !obj.allowedZones.includes(targetZoneId)) {
        // Зона не разрешена — объект возвращается.
        logEvent('dnd_change', { action: 'drop_rejected', objectId, zoneId: targetZoneId });
        return;
      }

      // Удаляем объект из всех зон.
      const newState: DnDState = {};
      for (const [zoneId, items] of Object.entries(state)) {
        newState[zoneId] = items.filter((id) => id !== objectId);
      }
      // Добавляем в целевую зону.
      if (!newState[targetZoneId]) newState[targetZoneId] = [];
      // Проверяем лимит maxItems.
      const zone = zones.find((z) => z.zoneId === targetZoneId);
      if (zone?.maxItems && newState[targetZoneId].length >= zone.maxItems) {
        logEvent('dnd_change', { action: 'drop_full', objectId, zoneId: targetZoneId });
        return;
      }
      newState[targetZoneId].push(objectId);

      setState(newState);
      logEvent('dnd_change', { action: 'drop_success', objectId, zoneId: targetZoneId });
    },
    [objects, zones, state],
  );

  // Объект, который сейчас перетаскивается.
  const activeObject = activeId
    ? objects.find((o) => o.objectId === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4">
        {/* Зоны (корзины). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {zones.map((zone) => {
            const items = state[zone.zoneId] || [];
            const isAllowed =
              !activeObject || activeObject.allowedZones.includes(zone.zoneId);
            return (
              <DroppableZone
                key={zone.id}
                zoneId={zone.zoneId}
                label={zone.label}
                items={items}
                objects={objects}
                isHighlighted={!!activeObject && isAllowed}
                isRejected={!!activeObject && !isAllowed}
              />
            );
          })}
        </div>

        {/* Объекты без зоны (исходная позиция). */}
        <div className="card-surface">
          <h4 className="text-sm font-medium text-slate-500 mb-3">
            Доступные объекты
          </h4>
          <div className="flex flex-wrap gap-2">
            {(state.unassigned || []).map((objectId) => {
              const obj = objects.find((o) => o.objectId === objectId);
              if (!obj) return null;
              return <DraggableObject key={obj.id} object={obj} />;
            })}
            {(state.unassigned || []).length === 0 && (
              <span className="text-sm text-slate-400">
                Все объекты распределены
              </span>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

// ============================================================
// ВЛОЖЕННЫЕ КОМПОНЕНТЫ
// ============================================================

/** Droppable-зона (корзина). */
function DroppableZone({
  zoneId,
  label,
  items,
  objects,
  isHighlighted,
  isRejected,
}: {
  zoneId: string;
  label: string;
  items: string[];
  objects: Extract<Block, { type: 'DragObject' }>[];
  isHighlighted: boolean;
  isRejected: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'rounded-xl border-2 border-dashed p-3 min-h-[120px] transition-all duration-200',
        isOver && isHighlighted && 'border-accent bg-accent-light scale-[1.02]',
        isHighlighted && !isOver && 'border-accent/50 bg-accent-light/50',
        isRejected && 'border-red-300 bg-red-50',
        !isHighlighted && !isRejected && 'border-slate-300 bg-slate-50',
      )}
    >
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{label}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((objectId) => {
          const obj = objects.find((o) => o.objectId === objectId);
          if (!obj) return null;
          return <DraggableObject key={obj.id} object={obj} />;
        })}
        {items.length === 0 && (
          <span className="text-xs text-slate-400">Перетащите сюда</span>
        )}
      </div>
    </div>
  );
}

/** Draggable-объект. */
function DraggableObject({
  object,
}: {
  object: Extract<Block, { type: 'DragObject' }>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: object.objectId });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'px-3 py-2 rounded-lg bg-white border border-slate-300 shadow-sm cursor-grab',
        'hover:shadow-md hover:border-accent active:cursor-grabbing',
        'select-none text-sm font-medium text-slate-700',
        isDragging && 'opacity-50 z-50 scale-105',
      )}
    >
      {object.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={object.image} alt={object.label} className="w-8 h-8 inline-block mr-2 rounded" />
      )}
      {object.label}
    </div>
  );
}
