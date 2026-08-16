/**
 * components/common/Header.tsx — шапка приложения.
 * Показывает название конкурса и аватар пользователя (если авторизован).
 */

'use client';

import Link from 'next/link';
import { useUserStore } from '@/lib/store/userStore';

export function Header() {
  const { vkUser, isAuthed } = useUserStore();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-accent">Конкурс</span>
        </Link>
        {isAuthed && vkUser ? (
          <div className="flex items-center gap-2">
            {vkUser.photo_200 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vkUser.photo_200}
                alt={vkUser.name || 'Аватар'}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {vkUser.name || `${vkUser.first_name} ${vkUser.last_name}`}
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-500">Гость</span>
        )}
      </div>
    </header>
  );
}
