/**
 * components/common/Header.tsx — шапка приложения.
 * Показывает название конкурса и аватар пользователя (если авторизован).
 *
 * ПРАВКА (баг): клик по "Конкурс" не работал, если на странице карточки
 * была открыта модалка репоста/уведомлений — она перекрывала весь экран
 * фиксированным оверлеем (z-50) и перехватывала клик раньше, чем он
 * долетал до <Link href="/">. Теперь при клике мы сначала принудительно
 * закрываем все зарегистрированные модалки (useUiStore), а затем
 * выполняем переход — router.push вместо обычной ссылки, чтобы порядок
 * "закрыть → перейти" был гарантирован.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store/userStore';
import { useUiStore } from '@/lib/store/uiStore';

export function Header() {
  const { vkUser, isAuthed } = useUserStore();
  const closeAllModals = useUiStore((s) => s.closeAllModals);
  const router = useRouter();

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Закрываем все открытые модалки (репост, уведомления и т.п.),
    // чтобы оверлей не блокировал следующий рендер, и переходим на главную.
    closeAllModals();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-[60] bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" onClick={handleHomeClick} className="flex items-center gap-2 cursor-pointer">
          <span className="text-xl font-bold text-accent">Конкурс</span>
        </a>
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
