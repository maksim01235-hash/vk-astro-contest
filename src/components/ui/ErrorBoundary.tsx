/**
 * components/ui/ErrorBoundary.tsx — глобальный ErrorBoundary.
 * Ловит ошибки рендеринга, показывает понятное сообщение.
 */

'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { logEvent } from '@/lib/sheets/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Логируем ошибку в таблицу Logs.
    logEvent('api_error', {
      error: error.message,
      stack: errorInfo.componentStack,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="card-surface max-w-md text-center">
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">
              Что-то пошло не так
            </h1>
            <p className="text-slate-600 mb-4">
              Произошла ошибка. Попробуйте обновить страницу.
            </p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Обновить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
