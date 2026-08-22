/**
 * src/components/admin/PropertiesPanel.tsx — панель свойств для редактирования блоков.
 *
 * Обновления (август 2026):
 *  - ImageBlock: поддержка images[], layoutMode, gridColumns.
 *  - ImageMarkerBlock: новый тип блока + превью метки.
 *  - Исправлена типизация обновления свойств union-типа Block.
 */

'use client';

import type { Block, ImageBlock, ImageItem, ImageMarkerBlock as ImageMarkerBlockType } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import clsx from 'clsx';

interface Props {
  block: Block | null;
  onChange: (block: Block) => void;
}

export function PropertiesPanel({ block, onChange }: Props) {
  if (!block) {
    return (
      <div className="card-surface p-4 text-center text-slate-500">
        Выберите блок для редактирования
      </div>
    );
  }

  const updateBlock = (key: string, value: unknown) => {
    onChange({ ...block, [key]: value } as Block);
  };

  const renderCommonFields = () => (
    <>
      <Input label="ID блока" value={block.id} onChange={(e) => updateBlock('id', e.target.value)} disabled />
      <Input label="Порядок" type="number" value={block.order} onChange={(e) => updateBlock('order', parseInt(e.target.value, 10) || 0)} />
    </>
  );

  const addImage = () => {
    if (block.type !== 'ImageBlock') return;
    const newImage: ImageItem = { id: `${block.id}-${Date.now()}`, src: '', alt: '' };
    onChange({ ...block, images: [...(block.images || []), newImage] });
  };

  const removeImage = (index: number) => {
    if (block.type !== 'ImageBlock') return;
    onChange({ ...block, images: (block.images || []).filter((_, i) => i !== index) });
  };

  const updateImage = (index: number, key: keyof ImageItem, value: string) => {
    if (block.type !== 'ImageBlock') return;
    onChange({
      ...block,
      images: (block.images || []).map((image, i) => i === index ? { ...image, [key]: value } : image),
    });
  };

  if (block.type === 'ImageBlock') {
    const hasImagesArray = !!block.images?.length;

    return (
      <div className="card-surface flex flex-col gap-3 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">ImageBlock</h3>
        {renderCommonFields()}

        <div className="mt-2 border-t border-slate-200 pt-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-600">Режим отображения</h4>
          <label className="text-sm font-medium text-slate-700">
            Тип
            <select className="input-field mt-1.5" value={block.layoutMode || 'flex'} onChange={(e) => updateBlock('layoutMode', e.target.value as 'grid' | 'flex')}>
              <option value="flex">Flex (обёртка)</option>
              <option value="grid">Grid (сетка)</option>
            </select>
          </label>
          {(block.layoutMode || 'flex') === 'grid' && (
            <Input label="Число колонок" type="number" min={1} max={6} value={block.gridColumns || 3} onChange={(e) => updateBlock('gridColumns', parseInt(e.target.value, 10) || 3)} />
          )}
        </div>

        <div className="mt-2 border-t border-slate-200 pt-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-600">Изображения</h4>
          {hasImagesArray ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-500">Массив изображений</p>
              {block.images!.map((image, index) => (
                <div key={image.id} className="flex items-center gap-2 rounded bg-slate-50 p-2">
                  <span className="w-6 text-xs text-slate-400">{index + 1}.</span>
                  <input className="input-field flex-1 text-xs" value={image.src} onChange={(e) => updateImage(index, 'src', e.target.value)} placeholder="URL изображения" />
                  <button type="button" className="px-2 text-xs text-red-500 hover:text-red-700" onClick={() => removeImage(index)}>✕</button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addImage}>+ Добавить изображение</Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const first = block.images?.[0] || { src: '', alt: '' };
                  onChange({ ...block, src: first.src, alt: first.alt, images: undefined });
                }}
              >
                Переключить на одно изображение
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-500">Одиночное изображение</p>
              <Input label="URL изображения" value={block.src || ''} onChange={(e) => updateBlock('src', e.target.value)} placeholder="https://..." />
              <Input label="Alt-текст" value={block.alt || ''} onChange={(e) => updateBlock('alt', e.target.value)} placeholder="Описание" />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onChange({
                    ...block,
                    images: [{ id: `${block.id}-legacy`, src: block.src || '', alt: block.alt || '' }],
                    src: undefined,
                    alt: undefined,
                  });
                }}
              >
                Переключить на массив изображений
              </Button>
            </div>
          )}
        </div>

        <div className="mt-2 border-t border-slate-200 pt-3">
          <Input label="Макс. ширина (px)" type="number" value={block.maxImageWidth || ''} onChange={(e) => updateBlock('maxImageWidth', e.target.value ? parseInt(e.target.value, 10) : undefined)} />
          <Input label="Макс. высота (px)" type="number" value={block.maxImageHeight || ''} onChange={(e) => updateBlock('maxImageHeight', e.target.value ? parseInt(e.target.value, 10) : undefined)} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={block.viewer !== false} onChange={(e) => updateBlock('viewer', e.target.checked)} />
            Показывать полноэкранный просмотр
          </label>
        </div>
      </div>
    );
  }

  if (block.type === 'ImageMarkerBlock') {
    const markerColor = block.markerColor || '#3B82F6';
    const markerSizePercent = block.markerSizePercent || 5;

    return (
      <div className="card-surface flex flex-col gap-3 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Изображение с маркером</h3>
        {renderCommonFields()}
        <Input label="URL изображения" value={block.src} onChange={(e) => updateBlock('src', e.target.value)} placeholder="https://..." />
        <Input label="Alt-текст" value={block.alt || ''} onChange={(e) => updateBlock('alt', e.target.value)} placeholder="Описание" />
        <Input label="Макс. ширина (px)" type="number" value={block.maxImageWidth || ''} onChange={(e) => updateBlock('maxImageWidth', e.target.value ? parseInt(e.target.value, 10) : undefined)} />
        <Input label="Макс. высота (px)" type="number" value={block.maxImageHeight || ''} onChange={(e) => updateBlock('maxImageHeight', e.target.value ? parseInt(e.target.value, 10) : undefined)} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={block.viewer !== false} onChange={(e) => updateBlock('viewer', e.target.checked)} />
          Показывать полноэкранный просмотр
        </label>

        <div className="mt-2 border-t border-slate-200 pt-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-600">Настройки правильного ответа</h4>
          <Input label="Правильный X (%)" type="number" min={0} max={100} value={block.correctX} onChange={(e) => updateBlock('correctX', parseFloat(e.target.value) || 0)} />
          <Input label="Правильный Y (%)" type="number" min={0} max={100} value={block.correctY} onChange={(e) => updateBlock('correctY', parseFloat(e.target.value) || 0)} />
          <Input label="Допустимое отклонение (%)" type="number" min={0} max={100} value={block.errorPercent} onChange={(e) => updateBlock('errorPercent', parseFloat(e.target.value) || 0)} />
          <Input label="Цвет метки (hex)" value={block.markerColor || '#3B82F6'} onChange={(e) => updateBlock('markerColor', e.target.value)} placeholder="#3B82F6" />
          <Input label="Размер метки (% изображения)" type="number" min={2} max={20} value={block.markerSizePercent || 5} onChange={(e) => updateBlock('markerSizePercent', parseFloat(e.target.value) || 5)} />
        </div>

        {block.src && (
          <div className="mt-2 border-t border-slate-200 pt-3">
            <h4 className="mb-2 text-xs font-semibold text-slate-600">Превью правильной позиции</h4>
            <div className="relative w-full overflow-hidden rounded-xl bg-slate-100">
              <img src={block.src} alt="Превью" className="w-full" style={{ maxHeight: '200px', objectFit: 'contain' }} />
              <span
                className={clsx('absolute rounded-full border-2 border-white shadow-md')}
                style={{
                  left: `${block.correctX}%`,
                  top: `${block.correctY}%`,
                  width: `${markerSizePercent}%`,
                  aspectRatio: '1',
                  backgroundColor: markerColor,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 2px rgba(0,0,0,.3)',
                }}
              />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white">X: {block.correctX}%, Y: {block.correctY}%</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'InputField') {
    return <div className="card-surface flex flex-col gap-3 p-4"><h3 className="mb-2 text-sm font-semibold text-slate-700">InputField</h3>{renderCommonFields()}<Input label="Текст" value={block.label} onChange={(e) => updateBlock('label', e.target.value)} placeholder="Введите ответ" /><Input label="Placeholder" value={block.placeholder || ''} onChange={(e) => updateBlock('placeholder', e.target.value)} placeholder="Например: 42" /><label className="text-sm font-medium text-slate-700">Тип поля<select className="input-field mt-1.5" value={block.inputType || 'text'} onChange={(e) => updateBlock('inputType', e.target.value as 'text' | 'number' | 'email')}><option value="text">Текст</option><option value="number">Число</option><option value="email">Email</option></select></label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={block.required || false} onChange={(e) => updateBlock('required', e.target.checked)} />Обязательное поле</label><Input label="Ключ ответа" value={block.answerKey} onChange={(e) => updateBlock('answerKey', e.target.value)} disabled /></div>;
  }

  if (block.type === 'Button') {
    return <div className="card-surface flex flex-col gap-3 p-4"><h3 className="mb-2 text-sm font-semibold text-slate-700">Button</h3>{renderCommonFields()}<Input label="Текст" value={block.label} onChange={(e) => updateBlock('label', e.target.value)} placeholder="Отправить" /><label className="text-sm font-medium text-slate-700">Действие<select className="input-field mt-1.5" value={block.action} onChange={(e) => updateBlock('action', e.target.value as 'submit' | 'repost' | 'custom')}><option value="submit">Отправить ответ</option><option value="repost">Репост</option><option value="custom">Другое</option></select></label><label className="text-sm font-medium text-slate-700">Стиль<select className="input-field mt-1.5" value={block.variant || 'primary'} onChange={(e) => updateBlock('variant', e.target.value as 'primary' | 'secondary' | 'danger')}><option value="primary">Основной</option><option value="secondary">Вторичный</option><option value="danger">Опасный</option></select></label></div>;
  }

  if (block.type === 'DragZone') {
    return <div className="card-surface flex flex-col gap-3 p-4"><h3 className="mb-2 text-sm font-semibold text-slate-700">DragZone</h3>{renderCommonFields()}<Input label="ID зоны" value={block.zoneId} onChange={(e) => updateBlock('zoneId', e.target.value)} disabled /><Input label="Название" value={block.label} onChange={(e) => updateBlock('label', e.target.value)} placeholder="Зона 1" /><Input label="Макс. объектов" type="number" value={block.maxItems || ''} onChange={(e) => updateBlock('maxItems', e.target.value ? parseInt(e.target.value, 10) : undefined)} placeholder="Пусто — без лимита" /></div>;
  }

  if (block.type === 'DragObject') {
    return <div className="card-surface flex flex-col gap-3 p-4"><h3 className="mb-2 text-sm font-semibold text-slate-700">DragObject</h3>{renderCommonFields()}<Input label="ID объекта" value={block.objectId} onChange={(e) => updateBlock('objectId', e.target.value)} disabled /><Input label="Текст" value={block.label || ''} onChange={(e) => updateBlock('label', e.target.value)} placeholder="Объект 1" /><label className="text-sm font-medium text-slate-700">Положение текста<select className="input-field mt-1.5" value={block.textPosition || 'left'} onChange={(e) => updateBlock('textPosition', e.target.value as 'left' | 'right' | 'top' | 'bottom')}><option value="left">Слева</option><option value="right">Справа</option><option value="top">Сверху</option><option value="bottom">Снизу</option></select></label><Input label="Разрешённые зоны (через запятую)" value={block.allowedZones.join(', ')} onChange={(e) => updateBlock('allowedZones', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="zone_1, zone_2" /><Input label="URL изображения" value={block.image || ''} onChange={(e) => updateBlock('image', e.target.value)} placeholder="https://..." /><Input label="Макс. размер (px)" type="number" value={block.maxImageSize || ''} onChange={(e) => updateBlock('maxImageSize', e.target.value ? parseInt(e.target.value, 10) : undefined)} /><Input label="Фикс. размер (px)" type="number" value={block.imageSize || ''} onChange={(e) => updateBlock('imageSize', e.target.value ? parseInt(e.target.value, 10) : undefined)} /></div>;
  }

  return <div className="card-surface flex flex-col gap-3 p-4"><h3 className="mb-2 text-sm font-semibold text-slate-700">TextBlock</h3>{renderCommonFields()}<div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Содержимое (Markdown)</label><textarea className="input-field min-h-[120px] resize-y" value={block.content} onChange={(e) => updateBlock('content', e.target.value)} placeholder={'# Заголовок\nТекст...'} /></div></div>;
}
