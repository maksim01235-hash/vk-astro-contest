/**
 * components/quiz/CardRenderer.tsx — рендерит карточку по JSON-схеме.
 * Проходит по массиву блоков в их порядке (по полю order) и рендерит
 * соответствующий компонент по type. DnD-блоки (DragZone, DragObject)
 * группируются в один DnDContainer в месте их первого появления.
 *
 * Сбор данных при отправке — из refs всех блоков.
 *
 * Обновления (август 2026):
 *  - Схлопывание user_answer перед отправкой:
 *    * dnd не пуст → полный формат {"inputs":{...},"dnd":{...}}.
 *    * dnd пуст, один input → просто значение.
 *    * dnd пуст, несколько inputs → склейка через ";" в порядке answerKey.
 */

'use client';

import { Block, CardSchema, DnDState, AnswerPayload } from '@/types';
import { TextBlockView } from './blocks/TextBlock';
import { ImageBlockView } from './blocks/ImageBlock';
import { InputFieldView } from './blocks/InputField';
import { ButtonView } from './blocks/Button';
import { DnDContainer } from './DnDContainer';
import { safeParse } from '@/utils/json';
import { useRef, useCallback } from 'react';

interface CardRendererProps {
  jsonSchema: string; // JSON-строка из Sheets
  onSubmit: (payload: AnswerPayload) => void;
  submitting: boolean;
}

export function CardRenderer({ jsonSchema, onSubmit, submitting }: CardRendererProps) {
  const schema = safeParse<CardSchema>(jsonSchema, { blocks: [] });
  // Рефы для сбора данных с блоков.
  const inputsRef = useRef<Record<string, string>>({});
  const dndRef = useRef<DnDState>({});

  // Стабильная ссылка на колбэк — не пересоздаётся между рендерами,
  // поэтому useEffect внутри DnDContainer не перезапускается впустую.
  const handleDndStateChange = useCallback((state: DnDState) => {
    dndRef.current = state;
  }, []);

  if (!schema.blocks || schema.blocks.length === 0) {
    return (
      <div className="card-surface text-center text-slate-500">
        У этой карточки нет содержимого.
      </div>
    );
  }

  /**
   * Собрать данные со всех блоков, схлопнуть user_answer и вызвать onSubmit.
   */
  const handleSubmit = () => {
    const inputs = { ...inputsRef.current };
    const dnd = { ...dndRef.current };

    // Проверяем, пуст ли dnd (игнорируем unassigned).
    let dndEmpty = true;
    for (const key of Object.keys(dnd)) {
      if (key !== 'unassigned' && dnd[key].length > 0) {
        dndEmpty = false;
        break;
      }
    }

    let payload: AnswerPayload;

    if (!dndEmpty) {
      // DnD не пуст → полный формат.
      payload = { inputs, dnd };
    } else {
      // DnD пуст → схлопываем inputs.
      const keys = Object.keys(inputs);
      if (keys.length === 1) {
        // Один input → просто значение (передаём как строку в inputs, но на сервере схлопнется).
        payload = { inputs: { answer: inputs[keys[0]] }, dnd: {} };
      } else if (keys.length > 1) {
        // Несколько inputs → склейка через ";" в порядке keys.
        keys.sort();
        const joined = keys.map((k) => inputs[k]).join(';');
        payload = { inputs: { answer: joined }, dnd: {} };
      } else {
        // Нет inputs и dnd пуст → пустой payload.
        payload = { inputs: {}, dnd: {} };
      }
    }

    onSubmit(payload);
  };

  // Сортируем блоки по order, чтобы сохранить порядок из схемы.
  const sortedBlocks = [...schema.blocks].sort((a, b) => a.order - b.order);

  // Рендерим блоки по порядку. DnD-блоки группируем: при первом DnD-блоке
  // рендерим DnDContainer со всеми DnD-блоками, остальные пропускаем.
  let dndRendered = false;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {sortedBlocks.map((block) => {
        // DnD-блоки: рендерим один контейнер при первом встрече.
        if (block.type === 'DragZone' || block.type === 'DragObject') {
          if (dndRendered) return null; // уже отрендерили контейнер
          dndRendered = true;
          const dndBlocks = sortedBlocks.filter(
            (b) => b.type === 'DragZone' || b.type === 'DragObject',
          );
          return (
            <DnDContainer
              key="dnd-container"
              blocks={dndBlocks}
              onStateChange={handleDndStateChange}
            />
          );
        }

        // Обычные блоки.
        switch (block.type) {
          case 'TextBlock':
            return <TextBlockView key={block.id} block={block} />;
          case 'ImageBlock':
            return <ImageBlockView key={block.id} block={block} />;
          case 'InputField':
            return (
              <InputFieldView
                key={block.id}
                block={block}
                onChange={(val) => {
                  inputsRef.current[block.answerKey] = val;
                }}
              />
            );
          case 'Button':
            return (
              <ButtonView
                key={block.id}
                block={block}
                onClick={handleSubmit}
                loading={submitting}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}