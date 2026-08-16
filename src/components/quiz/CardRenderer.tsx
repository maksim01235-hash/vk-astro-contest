/**
 * components/quiz/CardRenderer.tsx — рендерит карточку по JSON-схеме.
 * Проходит по массиву блоков в их порядке (по полю order) и рендерит
 * соответствующий компонент по type. DnD-блоки (DragZone, DragObject)
 * группируются в один DnDContainer в месте их первого появления.
 *
 * Сбор данных при отправке — из refs всех блоков.
 */

'use client';

import { Block, CardSchema, DnDState, AnswerPayload } from '@/types';
import { TextBlockView } from './blocks/TextBlock';
import { ImageBlockView } from './blocks/ImageBlock';
import { InputFieldView } from './blocks/InputField';
import { ButtonView } from './blocks/Button';
import { DnDContainer } from './DnDContainer';
import { safeParse } from '@/utils/json';
import { useRef, useState } from 'react';

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
  // Триггер перерисовки DnDContainer при изменении состояния.
  const [, forceUpdate] = useState({});

  if (!schema.blocks || schema.blocks.length === 0) {
    return (
      <div className="card-surface text-center text-slate-500">
        У этой карточки нет содержимого.
      </div>
    );
  }

  /** Собрать данные со всех блоков и вызвать onSubmit. */
  const handleSubmit = () => {
    const payload: AnswerPayload = {
      inputs: { ...inputsRef.current },
      dnd: { ...dndRef.current },
    };
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
              onStateChange={(state) => {
                dndRef.current = state;
                forceUpdate({});
              }}
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
