'use client';

import type { AnswerPayload, CardSchema, DnDState } from '@/types';
import { TextBlockView } from './blocks/TextBlock';
import { ImageBlockView } from './blocks/ImageBlock';
import { InputFieldView } from './blocks/InputField';
import { ButtonView } from './blocks/Button';
import { DnDContainer } from './DnDContainer';
import { safeParseSchema } from '@/utils/json';
import { useCallback, useRef } from 'react';

interface Props {
  jsonSchema: string;
  onSubmit: (payload: AnswerPayload) => void;
  submitting: boolean;
}

export function CardRenderer({ jsonSchema, onSubmit, submitting }: Props) {
  const schema = safeParseSchema<CardSchema>(jsonSchema, { blocks: [] });
  const inputsRef = useRef<Record<string, string>>({});
  const dndRef = useRef<DnDState>({});
  const handleDndStateChange = useCallback((state: DnDState) => { dndRef.current = state; }, []);

  if (!schema.blocks?.length) return <div className="card-surface text-center text-slate-500">У этой карточки нет содержимого.</div>;
  const blocks = [...schema.blocks].sort((a, b) => a.order - b.order);
  const cardHasDnd = blocks.some((block) => block.type === 'DragZone' || block.type === 'DragObject');

  const handleSubmit = () => {
    const inputs = { ...inputsRef.current };
    const dnd = { ...dndRef.current };
    if (cardHasDnd) return onSubmit({ inputs, dnd });
    const keys = Object.keys(inputs).sort();
    if (keys.length === 1) return onSubmit({ inputs: { answer: inputs[keys[0]] }, dnd: {} });
    if (keys.length > 1) return onSubmit({ inputs: { answer: keys.map((key) => inputs[key]).join(';') }, dnd: {} });
    onSubmit({ inputs: {}, dnd: {} });
  };

  let dndRendered = false;
  return <div className="flex flex-col gap-4 animate-fade-in">{blocks.map((block) => {
    if (block.type === 'DragZone' || block.type === 'DragObject') {
      if (dndRendered) return null;
      dndRendered = true;
      return <DnDContainer key="dnd-container" blocks={blocks.filter((item) => item.type === 'DragZone' || item.type === 'DragObject')} onStateChange={handleDndStateChange} />;
    }
    switch (block.type) {
      case 'TextBlock': return <TextBlockView key={block.id} block={block} />;
      case 'ImageBlock': return <ImageBlockView key={block.id} block={block} />;
      case 'InputField': return <InputFieldView key={block.id} block={block} onChange={(value) => { inputsRef.current[block.answerKey] = value; }} />;
      case 'Button': return <ButtonView key={block.id} block={block} onClick={handleSubmit} loading={submitting} />;
      default: return null;
    }
  })}</div>;
}
