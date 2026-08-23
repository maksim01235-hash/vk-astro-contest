/**
 * src/components/quiz/CardRenderer.tsx — рендерит карточку по JSON-схеме.
 *
 * Формат ответа:
 *  - Всегда полный JSON { inputs, dnd }, включая пустое состояние
 *    и unassigned-объекты DnD. Никакого схлопывания для отдельных случаев.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type { Block, CardSchema, DnDState, AnswerPayload } from '@/types';
import { TextBlockView } from './blocks/TextBlock';
import { ImageBlockView } from './blocks/ImageBlock';
import { InputFieldView } from './blocks/InputField';
import { ButtonView } from './blocks/Button';
import { DnDContainer } from './DnDContainer';
import { safeParse } from '@/utils/json';

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

  const handleSubmit = () => {
    // Всегда отправляем полный JSON { inputs, dnd } — единый формат для всех карточек.
    onSubmit({ inputs: { ...inputsRef.current }, dnd: { ...dndRef.current } });
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