/**
 * app/admin/page.tsx — админ-панель: конструктор карточек.
 *
 * Защита: простой пароль (SHA-256-хеш). Вводится при входе.
 * ВАЖНО: это защита от случайного доступа, НЕ криптографическая.
 *
 * Интерфейс:
 *  - Слева — панель инструментов (BlockToolbar).
 *  - Центр — холст (Canvas) с перетаскиванием блоков.
 *  - Справа — свойства выбранного блока (PropertiesPanel).
 *  - Сверху — поля карточки (название, release_datetime, post_id).
 *  - Кнопка "Сохранить карточку" → формирует JSON-схему, отправляет в Sheets.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BlockToolbar } from '@/components/admin/BlockToolbar';
import { Canvas } from '@/components/admin/Canvas';
import { PropertiesPanel } from '@/components/admin/PropertiesPanel';
import { createBlock } from '@/components/admin/blockFactory';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { sheetsApi } from '@/lib/sheets/api.client';
import { logEvent } from '@/lib/sheets/logger';
import { verifyPassword } from '@/utils/crypto';
import {
  ADMIN_PASSWORD_HASH,
  STORAGE_ADMIN_AUTH,
} from '@/constants';
import { getRaw, setRaw, remove } from '@/utils/storage';
import { safeStringify } from '@/utils/json';
// JSON.stringify с отступами для предпросмотра схемы.
const stringifyPretty = (obj: unknown) => {
  try { return JSON.stringify(obj, null, 2); } catch { return ''; };
};
import type { Block, BlockType, CardRecord } from '@/types';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authChecking, setAuthChecking] = useState(false);

  // Поля карточки.
  const [cardId, setCardId] = useState('');
  const [title, setTitle] = useState('');
  const [releaseDatetime, setReleaseDatetime] = useState('');
  const [postId, setPostId] = useState('');

  // Блоки на холсте.
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toast = useToast();

  /** Проверка, авторизован ли в этой сессии. */
  useEffect(() => {
    const isAuthed = getRaw<boolean>(STORAGE_ADMIN_AUTH);
    if (isAuthed) setAuthed(true);
  }, []);

  /** Вход по паролю. */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthChecking(true);
    setAuthError('');
    try {
      // Если хеш не задан — пропускаем (demo-режим).
      if (!ADMIN_PASSWORD_HASH) {
        setAuthed(true);
        setRaw(STORAGE_ADMIN_AUTH, true);
        await logEvent('admin_login', { mode: 'no_hash' });
        return;
      }
      const ok = await verifyPassword(password, ADMIN_PASSWORD_HASH);
      if (ok) {
        setAuthed(true);
        setRaw(STORAGE_ADMIN_AUTH, true);
        setPassword('');
        await logEvent('admin_login', { success: true });
      } else {
        setAuthError('Неверный пароль');
        await logEvent('admin_login', { success: false });
      }
    } catch (e) {
      setAuthError('Ошибка проверки пароля');
      await logEvent('admin_login', { error: String(e) });
    } finally {
      setAuthChecking(false);
    }
  };

  /** Выход. */
  const handleLogout = () => {
    setAuthed(false);
    remove(STORAGE_ADMIN_AUTH);
  };

  /** Добавить блок на холст. */
  const addBlock = (type: BlockType) => {
    const newBlock = createBlock(type, blocks.length);
    setBlocks([...blocks, newBlock]);
    setSelectedId(newBlock.id);
  };

  /** Обновить блок (из PropertiesPanel). */
  const updateBlock = (updated: Block) => {
    setBlocks(blocks.map((b) => (b.id === updated.id ? updated : b)));
  };

  /** Сохранить карточку в Google Sheets. */
  const handleSave = async () => {
    if (!cardId || !title) {
      toast.error('Заполните ID и название карточки');
      return;
    }
    try {
      const card: CardRecord = {
        card_id: cardId,
        title,
        release_datetime: releaseDatetime
          ? new Date(releaseDatetime).toISOString()
          : new Date().toISOString(),
        post_id: postId,
        json_schema: safeStringify({ blocks }),
        is_active: true,
      };
      await sheetsApi.saveCard(card);
      await logEvent('admin_save_card', { card_id: cardId, blocks_count: blocks.length });
      toast.success('Карточка сохранена!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения';
      toast.error(msg);
      await logEvent('api_error', { action: 'saveCard', error: msg });
    }
  };

  /** Показать JSON-схему (для отладки). */
  const [showJson, setShowJson] = useState(false);

  // Экран входа.
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="card-surface max-w-md w-full">
          <h1 className="text-2xl font-bold text-slate-900 mb-4 text-center">
            Вход в админку
          </h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              error={authError || undefined}
            />
            <Button type="submit" loading={authChecking}>
              Войти
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Конструктор.
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Конструктор карточек
        </h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/stats" className="btn-secondary text-sm">
            Статистика
          </Link>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Выйти
          </Button>
        </div>
      </div>

      {/* Поля карточки. */}
      <div className="card-surface mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Параметры карточки
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="ID карточки"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            placeholder="1"
          />
          <Input
            label="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Логическая задача"
          />
          <Input
            label="Дата/время открытия"
            type="datetime-local"
            value={releaseDatetime}
            onChange={(e) => setReleaseDatetime(e.target.value)}
          />
          <Input
            label="ID поста (для репоста)"
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
            placeholder="123"
          />
        </div>
      </div>

      {/* Трёхколоночный layout: инструменты | холст | свойства. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BlockToolbar onAdd={addBlock} />
        </div>
        <div className="lg:col-span-1">
          <Canvas
            blocks={blocks}
            onChange={setBlocks}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="lg:col-span-1">
          <PropertiesPanel
            block={blocks.find((b) => b.id === selectedId) || null}
            onChange={updateBlock}
          />
        </div>
      </div>

      {/* Кнопки сохранения. */}
      <div className="flex items-center gap-3 mt-4">
        <Button onClick={handleSave}>Сохранить карточку</Button>
        <Button variant="secondary" onClick={() => setShowJson(!showJson)}>
          {showJson ? 'Скрыть JSON' : 'Показать JSON'}
        </Button>
      </div>

      {/* Предпросмотр JSON-схемы. */}
      {showJson && (
        <pre className="card-surface mt-4 overflow-x-auto text-xs text-slate-700 max-h-96 overflow-y-auto">
          {stringifyPretty({ blocks })}
        </pre>
      )}
    </div>
  );
}
