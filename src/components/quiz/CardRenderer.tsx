/**
 * src/components/quiz/CardRenderer.tsx — рендерит карточку по JSON-схеме.
 *
 * Формат ответа:
 *  - Карточка содержит хотя бы один DnD-блок → всегда полный JSON { inputs, dnd },
 *    включая пустое состояние и unassigned-объекты.
 *  - DnD-блоков нет, одно текстовое поле → его значение без JSON-обёртки.
 *  - DnD-блоков нет, несколько текстовых полей → значения через ";".
 */

'use client';

import type { Block, CardSchema, DnDState, AnswerPayload } from '@/types';
import { TextBlockView } from './blocks/TextBlock';
import { ImageBlockView } from './blocks/ImageBlock';
import { InputFieldView } from './blocks/InputField';
import { ButtonView } from './blocks/Button';
import { DnDContainer } from './DnDContainer';
import { safeParse } from '@/utils/json';
import { useCallback, useRef } from 'react';

interface CardRendererProps {
  jsonSchema: string;
  onSubmit: (payload: AnswerPayload) => void;
  submitting: boolean;
}

export function CardRenderer({ jsonSchema, onSubmit, submitting }: CardRendererProps) {
  const schema = safeParse<CardSchema>(jsonSchema, { blocks: [] });
  const inputsRef = useRef<Record<string, string>>({});
  const dndRef = useRef<DnDState>({});

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

  const sortedBlocks = [...schema.blocks].sort((a, b) => a.order - b.order);

  /**
   * DnD-формат определяется по СХЕМЕ карточки, а не по тому,
   * размещал ли пользователь объекты. Это сохраняет полную структуру
   * даже при пустом ответе: { inputs: {}, dnd: { unassigned: [...] } }.
   */
  const cardHasDnd = sortedBlocks.some(
    (block) => block.type === 'DragZone' || block.type === 'DragObject',
  );

  const handleSubmit = () => {
    const inputs = { ...inputsRef.current };
    const dnd = { ...dndRef.current };

    if (cardHasDnd) {
      // В DnD-карточке всегда оставляем полный JSON.
      // Ключи dnd — это zoneId корзин, плюс unassigned для нераспределённых объектов.
      onSubmit({ inputs, dnd });
      return;
    }

    const inputKeys = Object.keys(inputs).sort();

    if (inputKeys.length === 1) {
      // Один текстовый ответ: сервер сохранит чистую строку.
      onSubmit({
        inputs: { answer: inputs[inputKeys[0]] },
        dnd: {},
      });
      return;
    }

    if (inputKeys.length > 1) {
      // Несколько текстовых полей: значения в стабильном порядке через ";".
      onSubmit({
        inputs: { answer: inputKeys.map((key) => inputs[key]).join(';') },
        dnd: {},
      });
      return;
    }

    // Карточка без текстовых полей и без DnD.
    onSubmit({ inputs: {}, dnd: {} });
  };

  let dndRendered = false;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {sortedBlocks.map((block) => {
        if (block.type === 'DragZone' || block.type === 'DragObject') {
          if (dndRendered) return null;
          dndRendered = true;

          const dndBlocks = sortedBlocks.filter(
            (item) => item.type === 'DragZone' || item.type === 'DragObject',
          );

          return (
            <DnDContainer
              key="dnd-container"
              blocks={dndBlocks}
              onStateChange={handleDndStateChange}
            />
          );
        }

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
                onChange={(value) => {
                  inputsRef.current[block.answerKey] = value;
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