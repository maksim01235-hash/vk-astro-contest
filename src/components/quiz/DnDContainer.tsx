'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter, useDroppable, useDraggable } from '@dnd-kit/core';
import type { Block, DnDState, LayoutMode } from '@/types';
import { logEvent } from '@/lib/sheets/logger';
import clsx from 'clsx';

interface Props { blocks: Block[]; onStateChange: (state: DnDState) => void; }
const cols = (value?: number) => Math.max(1, Math.min(value || 2, 6));
const layoutStyle = (mode?: LayoutMode, gridColumns?: number): React.CSSProperties => mode === 'grid' ? { display: 'grid', gridTemplateColumns: `repeat(${cols(gridColumns)}, minmax(0, 1fr))` } : {};

export function DnDContainer({ blocks, onStateChange }: Props) {
  const zones = blocks.filter((b): b is Extract<Block, { type: 'DragZone' }> => b.type === 'DragZone');
  const objects = blocks.filter((b): b is Extract<Block, { type: 'DragObject' }> => b.type === 'DragObject');
  const [state, setState] = useState<DnDState>({ unassigned: objects.map((o) => o.objectId) });
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 10 } }), useSensor(KeyboardSensor));
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { onStateChangeRef.current(state); }, [state]);
  const handleDragStart = useCallback((event: DragStartEvent) => { setActiveId(String(event.active.id)); logEvent('dnd_change', { action: 'drag_start', objectId: String(event.active.id) }); }, []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const objectId = String(event.active.id);
    const targetZoneId = event.over ? String(event.over.id) : 'unassigned';
    setActiveId(null);
    const obj = objects.find((o) => o.objectId === objectId);
    if (!obj) return;
    if (targetZoneId !== 'unassigned' && !obj.allowedZones.includes(targetZoneId)) { logEvent('dnd_change', { action: 'drop_rejected', objectId, zoneId: targetZoneId }); return; }
    const newState: DnDState = {};
    for (const [zoneId, items] of Object.entries(state)) newState[zoneId] = items.filter((id) => id !== objectId);
    if (!newState[targetZoneId]) newState[targetZoneId] = [];
    const zone = zones.find((z) => z.zoneId === targetZoneId);
    if (zone?.maxItems && newState[targetZoneId].length >= zone.maxItems) { logEvent('dnd_change', { action: 'drop_full', objectId, zoneId: targetZoneId }); return; }
    newState[targetZoneId].push(objectId);
    setState(newState);
    logEvent('dnd_change', { action: 'drop_success', objectId, zoneId: targetZoneId });
  }, [objects, zones, state]);
  const activeObject = activeId ? objects.find((o) => o.objectId === activeId) : null;
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><div className="flex flex-col gap-4"><div className="flex flex-wrap gap-3">{zones.map((zone) => <DroppableZone key={zone.id} zoneId={zone.zoneId} label={zone.label} items={state[zone.zoneId] || []} objects={objects} layoutMode={zone.layoutMode} gridColumns={zone.gridColumns} isHighlighted={!!activeObject && activeObject.allowedZones.includes(zone.zoneId)} isRejected={!!activeObject && !activeObject.allowedZones.includes(zone.zoneId)} />)}</div><div className="card-surface"><h4 className="mb-3 text-sm font-medium text-slate-500">Доступные объекты</h4><div className="flex flex-wrap gap-2">{(state.unassigned || []).map((id) => { const obj = objects.find((o) => o.objectId === id); return obj ? <DraggableObject key={obj.id} object={obj} /> : null; })}{(state.unassigned || []).length === 0 && <span className="text-sm text-slate-400">Все объекты распределены</span>}</div></div></div></DndContext>;
}

function DroppableZone({ zoneId, label, items, objects, layoutMode, gridColumns, isHighlighted, isRejected }: { zoneId: string; label: string; items: string[]; objects: Extract<Block, { type: 'DragObject' }>[]; layoutMode?: LayoutMode; gridColumns?: number; isHighlighted: boolean; isRejected: boolean; }) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId });
  return <div ref={setNodeRef} className={clsx('min-h-[120px] min-w-[160px] max-w-full flex-1 basis-[200px] rounded-xl border-2 border-dashed p-3 transition-all', isOver && isHighlighted && 'scale-[1.02] border-accent bg-accent-light', isHighlighted && !isOver && 'border-accent/50 bg-accent-light/50', isRejected && 'border-red-300 bg-red-50', !isHighlighted && !isRejected && 'border-slate-300 bg-slate-50')}><h4 className="mb-2 text-sm font-semibold text-slate-700">{label}</h4><div className={layoutMode === 'grid' ? 'gap-2' : 'flex flex-wrap gap-2'} style={layoutStyle(layoutMode, gridColumns)}>{items.map((id) => { const obj = objects.find((o) => o.objectId === id); return obj ? <DraggableObject key={obj.id} object={obj} /> : null; })}{items.length === 0 && <span className="text-xs text-slate-400">Перетащите сюда</span>}</div></div>;
}

function DraggableObject({ object }: { object: Extract<Block, { type: 'DragObject' }> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: object.objectId });
  const style: React.CSSProperties = { ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}), touchAction: 'none' };
  const imgSize = object.imageSize || object.maxImageSize;
  const imgStyle = imgSize ? { width: `${imgSize}px`, height: `${imgSize}px` } : object.maxImageSize ? { maxWidth: `${object.maxImageSize}px`, maxHeight: `${object.maxImageSize}px` } : undefined;
  const hasImage = !!object.image;
  const hasLabel = !!object.label?.trim();
  const textPos = object.textPosition || 'left';
  const flexClass = !hasImage || !hasLabel ? 'flex-row' : textPos === 'left' ? 'flex-row-reverse' : textPos === 'right' ? 'flex-row' : textPos === 'top' ? 'flex-col-reverse' : 'flex-col';
  return <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={clsx('flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm select-none cursor-grab hover:border-accent hover:shadow-md active:cursor-grabbing', isDragging && 'z-50 scale-105 opacity-50', flexClass, object.layoutMode === 'grid' && 'grid')}>{object.image && <img src={object.image} alt={object.label || 'DnD object'} className="rounded object-cover" style={imgStyle} draggable={false} />}{hasLabel && <span>{object.label}</span>}</div>;
}
