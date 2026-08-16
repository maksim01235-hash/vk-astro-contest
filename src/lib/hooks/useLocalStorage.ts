/**
 * lib/hooks/useLocalStorage.ts — обёртка над localStorage для React-компонентов.
 * Синхронизирует состояние React с localStorage.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  // Чтение при монтировании.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // ignore
    }
  }, [key]);

  // Запись.
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = v instanceof Function ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [key],
  );

  return [value, set];
}
