/**
 * src/components/quiz/CardRenderer.tsx — рендерит карточку по JSON-схеме.
 *
 * Обновления (август 2026):
 *  - Добавлена поддержка ImageMarkerBlock.
 *
 * Формат ответа:
 *  - Карточка содержит хотя бы один DnD-блок → всегда полный JSON { inputs, dnd },
 *    включая пустое состояние и unassigned-объекты.
 *  - DnD-блоков нет, одно текстовое поле → его значение без JSON-обёртки.
 *  - DnD-блоков нет, несколько текстовых полей → значения через ";".
 *  - Карточка содержит ImageMarkerBlock → добавляется поле marker.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type { Block, CardSchema, DnDState, AnswerPayload } from '@/types';
import { TextBlockView } from './blocks/TextBlock';
import { ImageBlockView } from './blocks/ImageBlock';
import { InputFieldView } from './blocks/InputField';
import { ButtonView } from './blocks/Button';
import { DnDContainer } from './DnDContainer';
import { ImageMarkerBlockView } from './blocks/ImageMarkerBlock';
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
  
  // Состояние для ImageMarkerBlock.
  const [markerState, setMarkerState] = useState<{
    userX: number;
    userY: number;
    confirmed: boolean;
  } | null>(null);

  const handleDndStateChange = useCallback((state: DnDState) => {
    dndRef.current = state;
  }, []);

  const handleMarkerChange = useCallback((x: number, y: number, confirmed: boolean) => {
    setMarkerState({ userX: x, userY: y, confirmed });
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

  /**
   * Проверяем наличие ImageMarkerBlock.
   */
  const cardHasMarker = sortedBlocks.some(
    (block) => block.type === 'ImageMarkerBlock',
  );

  const handleSubmit = () => {
    const inputs = { ...inputsRef.current };
    const dnd = { ...dndRef.current };

    // Если есть ImageMarkerBlock, проверяем, что метка подтверждена.
    if (cardHasMarker && (!markerState || !markerState.confirmed)) {
      alert('Зафиксируйте позицию метки перед отправкой ответа!');
      return;
    }

    if (cardHasDnd) {
      // В DnD-карточке всегда оставляем полный JSON.
      onSubmit({
        inputs,
        dnd,
        marker: markerState ? {
          userX: markerState.userX,
          userY: markerState.userY,
          actualErrorPercent: 0, // Вычисляется на сервере.
          isCorrect: false, // Вычисляется на сервере.
        } : undefined,
      });
      return;
    }

    const inputKeys = Object.keys(inputs).sort();

    if (inputKeys.length === 1) {
      // Один текстовый ответ: сервер сохранит чистую строку.
      onSubmit({
        inputs: { answer: inputs[inputKeys[0]] },
        dnd: {},
        marker: markerState ? {
          userX: markerState.userX,
          userY: markerState.userY,
          actualErrorPercent: 0,
          isCorrect: false,
        } : undefined,
      });
      return;
    }

    if (inputKeys.length > 1) {
      // Несколько текстовых полей: значения в стабильном порядке через ";".
      onSubmit({
        inputs: { answer: inputKeys.map((key) => inputs[key]).join(';') },
        dnd: {},
        marker: markerState ? {
          userX: markerState.userX,
          userY: markerState.userY,
          actualErrorPercent: 0,
          isCorrect: false,
        } : undefined,
      });
      return;
    }

    // Карточка без текстовых полей и без DnD, но с маркером.
    if (cardHasMarker && markerState) {
      onSubmit({
        inputs: {},
        dnd: {},
        marker: {
          userX: markerState.userX,
          userY: markerState.userY,
          actualErrorPercent: 0,
          isCorrect: false,
        },
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

        if (block.type === 'ImageMarkerBlock') {
          return (
            <ImageMarkerBlockView
              key={block.id}
              block={block}
              onMarkerChange={handleMarkerChange}
              onMarkerConfirm={() => {}}
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