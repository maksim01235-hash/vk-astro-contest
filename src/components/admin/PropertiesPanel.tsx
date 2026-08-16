/**
 * components/admin/PropertiesPanel.tsx — панель свойств выбранного блока.
 * Позволяет редактировать поля блока в зависимости от его типа.
 */

'use client';

import type { Block } from '@/types';
import { Input } from '@/components/ui/Input';

interface Props {
  block: Block | null;
  onChange: (block: Block) => void;
}

export function PropertiesPanel({ block, onChange }: Props) {
  if (!block) {
    return (
      <div className="card-surface">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Свойства
        </h3>
        <p className="text-sm text-slate-400">
          Выберите блок на холсте, чтобы редактировать его свойства.
        </p>
      </div>
    );
  }

  /** Обновить поле блока. */
  const update = (field: string, value: unknown) => {
    onChange({ ...block, [field]: value } as Block);
  };

  return (
    <div className="card-surface">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Свойства: {block.type}
      </h3>
      <div className="flex flex-col gap-3">
        {/* Общие поля для всех блоков. */}
        <Input
          label="ID блока"
          value={block.id}
          onChange={(e) => update('id', e.target.value)}
        />

        {/* Поля по типам. */}
        {block.type === 'TextBlock' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Содержание (Markdown)
            </label>
            <textarea
              className="input-field min-h-[100px] resize-y"
              value={block.content}
              onChange={(e) => update('content', e.target.value)}
            />
          </div>
        )}

        {block.type === 'ImageBlock' && (
          <>
            <Input
              label="URL картинки"
              value={block.src}
              onChange={(e) => update('src', e.target.value)}
            />
            <Input
              label="Alt-текст"
              value={block.alt || ''}
              onChange={(e) => update('alt', e.target.value)}
            />
          </>
        )}

        {block.type === 'InputField' && (
          <>
            <Input
              label="Подпись поля"
              value={block.label}
              onChange={(e) => update('label', e.target.value)}
            />
            <Input
              label="Placeholder"
              value={block.placeholder || ''}
              onChange={(e) => update('placeholder', e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Тип ввода
              </label>
              <select
                className="input-field"
                value={block.inputType || 'text'}
                onChange={(e) => update('inputType', e.target.value)}
              >
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="email">Email</option>
              </select>
            </div>
            <Input
              label="Ключ ответа (answerKey)"
              value={block.answerKey}
              onChange={(e) => update('answerKey', e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={block.required || false}
                onChange={(e) => update('required', e.target.checked)}
              />
              Обязательное
            </label>
          </>
        )}

        {block.type === 'Button' && (
          <>
            <Input
              label="Текст кнопки"
              value={block.label}
              onChange={(e) => update('label', e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Действие
              </label>
              <select
                className="input-field"
                value={block.action}
                onChange={(e) => update('action', e.target.value)}
              >
                <option value="submit">Отправить ответ</option>
                <option value="repost">Репост</option>
                <option value="custom">Кастомное</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Стиль
              </label>
              <select
                className="input-field"
                value={block.variant || 'primary'}
                onChange={(e) => update('variant', e.target.value)}
              >
                <option value="primary">Основной (синий)</option>
                <option value="secondary">Вторичный</option>
                <option value="danger">Красный</option>
              </select>
            </div>
          </>
        )}

        {block.type === 'DragZone' && (
          <>
            <Input
              label="ID зоны (zoneId)"
              value={block.zoneId}
              onChange={(e) => update('zoneId', e.target.value)}
            />
            <Input
              label="Название зоны"
              value={block.label}
              onChange={(e) => update('label', e.target.value)}
            />
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
            <Input
              label="ID объекта (objectId)"
              value={block.objectId}
              onChange={(e) => update('objectId', e.target.value)}
            />
            <Input
              label="Текст объекта"
              value={block.label}
              onChange={(e) => update('label', e.target.value)}
            />
            <Input
              label="URL картинки (опц.)"
              value={block.image || ''}
              onChange={(e) => update('image', e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Разрешённые зоны (через запятую)
              </label>
              <input
                className="input-field"
                value={block.allowedZones.join(', ')}
                onChange={(e) =>
                  update(
                    'allowedZones',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="zone1, zone2"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
