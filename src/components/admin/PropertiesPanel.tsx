'use client';

import { useEffect, useState } from 'react';
import type { Block, ImageItem, LayoutMode, TextPosition } from '@/types';
import { Input } from '@/components/ui/Input';
import { genId } from '@/utils/json';

interface Props {
  block: Block | null;
  onChange: (block: Block) => void;
}

const columns = (value: number | undefined) => Math.max(1, Math.min(value || 2, 6));

export function PropertiesPanel({ block, onChange }: Props) {
  const [zonesDraft, setZonesDraft] = useState('');

  useEffect(() => {
    if (block?.type === 'DragObject') setZonesDraft(block.allowedZones.join(', '));
  }, [block?.id, block?.type]);

  if (!block) {
    return <div className="card-surface"><h3 className="mb-3 text-sm font-semibold text-slate-700">Свойства</h3><p className="text-sm text-slate-400">Выберите блок на холсте, чтобы редактировать его свойства.</p></div>;
  }

  const update = (field: string, value: unknown) => onChange({ ...block, [field]: value } as Block);
  const updateImages = (images: ImageItem[]) => update('images', images);
  const legacyImages: ImageItem[] = block.type === 'ImageBlock' && !block.images?.length && block.src
    ? [{ id: `${block.id}-legacy`, src: block.src, alt: block.alt || '' }]
    : [];
  const images = block.type === 'ImageBlock' ? (block.images?.length ? block.images : legacyImages) : [];

  const updateImage = (index: number, field: keyof ImageItem, value: string) => {
    updateImages(images.map((image, i) => i === index ? { ...image, [field]: value } : image));
  };

  const addImage = () => updateImages([...images, { id: genId(), src: '', alt: '' }]);
  const removeImage = (index: number) => updateImages(images.filter((_, i) => i !== index));

  const layoutFields = (layoutMode: LayoutMode | undefined, gridColumns: number | undefined) => (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Расположение</label><select className="input-field" value={layoutMode || 'flow'} onChange={(e) => update('layoutMode', e.target.value as LayoutMode)}><option value="flow">Свободное (flow)</option><option value="grid">Сетка (grid)</option></select></div>
      <Input label="Колонки сетки (1–6)" type="number" min={1} max={6} value={String(columns(gridColumns))} onChange={(e) => update('gridColumns', columns(parseInt(e.target.value, 10)))} />
    </div>
  );

  return (
    <div className="card-surface"><h3 className="mb-3 text-sm font-semibold text-slate-700">Свойства: {block.type}</h3><div className="flex flex-col gap-3">
      <Input label="ID блока" value={block.id} onChange={(e) => update('id', e.target.value)} />

      {block.type === 'ImageBlock' && <>
        <div className="flex flex-col gap-3"><div className="flex items-center justify-between"><label className="text-sm font-medium text-slate-700">Изображения</label><button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={addImage}>Добавить</button></div>
          {images.map((image, index) => <div key={image.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3"><Input label={`URL изображения ${index + 1}`} value={image.src} onChange={(e) => updateImage(index, 'src', e.target.value)} /><Input label="Alt-текст" value={image.alt || ''} onChange={(e) => updateImage(index, 'alt', e.target.value)} /><button type="button" className="self-start text-sm text-red-500" onClick={() => removeImage(index)}>Удалить изображение</button></div>)}
          {images.length === 0 && <p className="text-sm text-slate-400">Добавьте хотя бы одно изображение.</p>}
        </div>
        {layoutFields(block.layoutMode, block.gridColumns)}
        <Input label="Макс. ширина картинки (px, опц.)" type="number" value={String(block.maxImageWidth || 0)} onChange={(e) => update('maxImageWidth', parseInt(e.target.value, 10) || 0)} placeholder="0 = без ограничения" />
        <Input label="Макс. высота картинки (px, опц.)" type="number" value={String(block.maxImageHeight || 0)} onChange={(e) => update('maxImageHeight', parseInt(e.target.value, 10) || 0)} placeholder="0 = без ограничения" />
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={block.viewer || false} onChange={(e) => update('viewer', e.target.checked)} />Картинка с viewer и zoom</label>
      </>}

      {block.type === 'TextBlock' && <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Содержание (Markdown)</label><textarea className="input-field min-h-[100px] resize-y" value={block.content} onChange={(e) => update('content', e.target.value)} /></div>}

      {block.type === 'InputField' && <><Input label="Подпись поля" value={block.label} onChange={(e) => update('label', e.target.value)} /><Input label="Placeholder" value={block.placeholder || ''} onChange={(e) => update('placeholder', e.target.value)} /><select className="input-field" value={block.inputType || 'text'} onChange={(e) => update('inputType', e.target.value)}><option value="text">Текст</option><option value="number">Число</option><option value="email">Email</option></select><Input label="Ключ ответа" value={block.answerKey} onChange={(e) => update('answerKey', e.target.value)} /><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={block.required || false} onChange={(e) => update('required', e.target.checked)} />Обязательное</label></>}

      {block.type === 'Button' && <><Input label="Текст кнопки" value={block.label} onChange={(e) => update('label', e.target.value)} /><select className="input-field" value={block.action} onChange={(e) => update('action', e.target.value)}><option value="submit">Отправить ответ</option><option value="repost">Репост</option><option value="custom">Кастомное</option></select><select className="input-field" value={block.variant || 'primary'} onChange={(e) => update('variant', e.target.value)}><option value="primary">Основной</option><option value="secondary">Вторичный</option><option value="danger">Красный</option></select></>}

      {block.type === 'DragZone' && <><Input label="ID зоны" value={block.zoneId} onChange={(e) => update('zoneId', e.target.value)} /><Input label="Название зоны" value={block.label} onChange={(e) => update('label', e.target.value)} /><Input label="Макс. объектов" type="number" value={String(block.maxItems || 0)} onChange={(e) => update('maxItems', parseInt(e.target.value, 10) || 0)} />{layoutFields(block.layoutMode, block.gridColumns)}</>}

      {block.type === 'DragObject' && <><Input label="ID объекта" value={block.objectId} onChange={(e) => update('objectId', e.target.value)} /><Input label="Текст объекта" value={block.label || ''} onChange={(e) => update('label', e.target.value)} /><Input label="URL картинки" value={block.image || ''} onChange={(e) => update('image', e.target.value)} /><select className="input-field" value={block.textPosition || 'left'} onChange={(e) => update('textPosition', e.target.value as TextPosition)}><option value="left">Слева от картинки</option><option value="right">Справа от картинки</option><option value="top">Над картинкой</option><option value="bottom">Под картинкой</option></select><Input label="Макс. размер картинки" type="number" value={String(block.maxImageSize || 0)} onChange={(e) => update('maxImageSize', parseInt(e.target.value, 10) || 0)} /><Input label="Фиксированный размер картинки" type="number" value={String(block.imageSize || 0)} onChange={(e) => update('imageSize', parseInt(e.target.value, 10) || 0)} /><div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Разрешённые зоны</label><input className="input-field" value={zonesDraft} onChange={(e) => { const raw = e.target.value; setZonesDraft(raw); update('allowedZones', raw.split(',').map((s) => s.trim()).filter(Boolean)); }} /></div>{layoutFields(block.layoutMode, block.gridColumns)}</>}
    </div></div>
  );
}
