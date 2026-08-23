/**
 * components/quiz/blocks/Button.tsx — кнопка в карточке (обычно "Отправить ответ").
 */

'use client';

import type { ButtonBlock as ButtonBlockType } from '@/types';
import { Button as UIButton } from '@/components/ui/Button';

interface Props {
  block: ButtonBlockType;
  onClick: () => void;
  loading: boolean;
}

export function ButtonView({ block, onClick, loading }: Props) {
  const variant = block.variant === 'danger' ? 'danger' : block.variant === 'secondary' ? 'secondary' : 'primary';

  return (
    <div className="flex justify-center">
      <UIButton
        variant={variant}
        onClick={onClick}
        loading={loading}
        className="w-full max-w-xs"
      >
        {block.label}
      </UIButton>
    </div>
  );
}
