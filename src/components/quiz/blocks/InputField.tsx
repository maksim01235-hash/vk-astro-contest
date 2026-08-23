/**
 * components/quiz/blocks/InputField.tsx — поле ввода ответа.
 */

'use client';

import type { InputFieldBlock as InputFieldBlockType } from '@/types';
import { Input } from '@/components/ui/Input';

interface Props {
  block: InputFieldBlockType;
  onChange: (value: string) => void;
}

export function InputFieldView({ block, onChange }: Props) {
  return (
    <div className="card-surface">
      <Input
        label={block.label}
        placeholder={block.placeholder || ''}
        type={block.inputType || 'text'}
        required={block.required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
