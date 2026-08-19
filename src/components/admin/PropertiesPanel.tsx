/**
 * components/admin/PropertiesPanel.tsx — панель свойств выбранного блока.
 *
 * Обновления (v3, август 2026):
 *  - ImageBlock: раздельные maxImageWidth/maxImageHeight, чекбокс "Картинка с viewer".
 *  - DragObject: label опционален, textPosition, maxImageSize/imageSize (накоплено ранее).
 */

'use client';

import { useState, useEffect } from 'react';
import type { Block, TextPosition } from '@/types';
import { Input } from '@/components/ui/Input';

interface Props {
  block: Block | null;
  onChange: (block: Block) => void;
}

export function PropertiesPanel({ block, onChange }: Props) {
  const [zonesDraft, setZonesDraft] = useState('');

  useEffect(() => {
    if (block?.type === 'DragObject') {
      setZonesDraft(block.allowedZones.join(', '));
    }
  }, [block?.id, block?.type]);

  if (!block) {
    return (
      <div className="card-surface">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Свойства</h3>
        <p className="text-sm text-slate-400">Выберите блок на холсте, чтобы редактировать его свойства.</p>
      </div>
    );
  }

  const update = (field: string, value: unknown) => {
    onChange({ ...block, [field]: value } as Block);
  };

  const handleZonesInput = (raw: string) => {
    setZonesDraft(raw);
    const zones = raw.split(',').map((s) => s.trim()).filter(Boolean);
    update('allowedZones', zones);
  };

  return (
    <div className="card-surface">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Свойства: {block.type}</h3>
      <div className="flex flex-col gap-3">
        <Input label="ID блока" value={block.id} onChange={(e) => update('id', e.target.value)} />

        {block.type === 'TextBlock' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Содержание (Markdown)</label>
            <textarea
              className="input-field min-h-[100px] resize-y"
              value={block.content}
              onChange={(e) => update('content', e.target.value)}
            />
          </div>
        )}

        {block.type === 'ImageBlock' && (
          <>
            <Input label="URL картинки" value={block.src} onChange={(e) => update('src', e.target.value)} />
            <Input label="Alt-текст" value={block.alt || ''} onChange={(e) => update('alt', e.target.value)} />
            <Input
              label="Макс. ширина картинки (px, опц.)"
              type="number"
              value={String(block.maxImageWidth || 0)}
              onChange={(e) => update('maxImageWidth', parseInt(e.target.value, 10) || 0)}
              placeholder="0 = без ограничения"
            />
            <Input
              label="Макс. высота картинки (px, опц.)"
              type="number"
              value={String(block.maxImageHeight || 0)}
              onChange={(e) => update('maxImageHeight', parseInt(e.target.value, 10) || 0)}
              placeholder="0 = без ограничения"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={block.viewer || false}
                onChange={(e) => update('viewer', e.target.checked)}
              />
              Картинка с viewer (кнопка полноэкранного просмотра с зумом)
            </label>
          </>
        )}

        {block.type === 'InputField' && (
          <>
            <Input label="Подпись поля" value={block.label} onChange={(e) => update('label', e.target.value)} />
            <Input label="Placeholder" value={block.placeholder || ''} onChange={(e) => update('placeholder', e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Тип ввода</label>
              <select className="input-field" value={block.inputType || 'text'} onChange={(e) => update('inputType', e.target.value)}>
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="email">Email</option>
              </select>
            </div>
            <Input label="Ключ ответа (answerKey)" value={block.answerKey} onChange={(e) => update('answerKey', e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={block.required || false} onChange={(e) => update('required', e.target.checked)} />
              Обязательное
            </label>
          </>
        )}

        {block.type === 'Button' && (
          <>
            <Input label="Текст кнопки" value={block.label} onChange={(e) => update('label', e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Действие</label>
              <select className="input-field" value={block.action} onChange={(e) => update('action', e.target.value)}>
                <option value="submit">Отправить ответ</option>
                <option value="repost">Репост</option>
                <option value="custom">Кастомное</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Стиль</label>
              <select className="input-field" value={block.variant || 'primary'} onChange={(e) => update('variant', e.target.value)}>
                <option value="primary">Основной (синий)</option>
                <option value="secondary">Вторичный</option>
                <option value="danger">Красный</option>
              </select>
            </div>
          </>
        )}

        {block.type === 'DragZone' && (
          <>
            <Input label="ID зоны (zoneId)" value={block.zoneId} onChange={(e) => update('zoneId', e.target.value)} />
            <Input label="Название зоны" value={block.label} onChange={(e) => update('label', e.target.value)} />
            <Input
              label="Макс. объектов (0 = без лимита)"
              type="number"
              value={String(block.maxItems || 0)}
              onChange={(e) => update('maxItems', parseInt(e.target.value, 10) || 0)}
            />
          </>
        )}

        {block.type === 'DragObject' && (
          <>
            <Input label="ID объекта (objectId)" value={block.objectId} onChange={(e) => update('objectId', e.target.value)} />
            <Input
              label="Текст объекта (опционально)"
              value={block.label || ''}
              onChange={(e) => update('label', e.target.value)}
              placeholder="Оставьте пустым, если только картинка"
            />
            <Input label="URL картинки (опц.)" value={block.image || ''} onChange={(e) => update('image', e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Положение текста</label>
              <select
                className="input-field"
                value={block.textPosition || 'left'}
                onChange={(e) => update('textPosition', e.target.value as TextPosition)}
              >
                <option value="left">Слева от картинки</option>
                <option value="right">Справа от картинки</option>
                <option value="top">Над картинкой</option>
                <option value="bottom">Под картинкой</option>
              </select>
            </div>
            <Input
              label="Макс. размер картинки (px, опц.)"
              type="number"
              value={String(block.maxImageSize || 0)}
              onChange={(e) => update('maxImageSize', parseInt(e.target.value, 10) || 0)}
              placeholder="0 = автоподстройка"
            />
            <Input
              label="Фиксированный размер картинки (px, опц.)"
              type="number"
              value={String(block.imageSize || 0)}
              onChange={(e) => update('imageSize', parseInt(e.target.value, 10) || 0)}
              placeholder="0 = использовать макс. размер"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Разрешённые зоны (через запятую)</label>
              <input
                className="input-field"
                value={zonesDraft}
                onChange={(e) => handleZonesInput(e.target.value)}
                placeholder="zone1, zone2"
              />
              <p className="text-xs text-slate-400">Введите ID зон через запятую. Пробелы вокруг запятой не важны.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}