/**
 * components/ui/Button.tsx — переиспользуемая кнопка.
 */

'use client';

import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'bg-red-500 text-white font-medium rounded-xl px-5 py-3 hover:bg-red-600 active:scale-95',
};

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-2',
  md: 'text-base px-5 py-3',
  lg: 'text-lg px-6 py-4',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Загрузка...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
