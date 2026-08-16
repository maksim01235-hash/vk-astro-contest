/**
 * components/ui/Input.tsx — переиспользуемое поле ввода.
 */

'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className, ...props }, ref) {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-slate-700">{label}</label>
        )}
        <input ref={ref} className={clsx('input-field', className)} {...props} />
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    );
  },
);
