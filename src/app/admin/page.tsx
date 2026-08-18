/**
 * app/admin/page.tsx — админ-панель: конструктор карточек.
 *
 * Обновления (август 2026):
 *  - Используется getCardsList() вместо getCards() для селектора карточек (без json_schema).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BlockToolbar } from '@/components/admin/BlockToolbar';
import { Canvas } from '@/components/admin/Canvas';
import { PropertiesPanel } from '@/components/admin/PropertiesPanel';
import { createBlock } from '@/components/admin/blockFactory';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { sheetsApi } from '@/lib/sheets/api.client';
import { verifyPassword } from '@/utils/crypto';
import {
  ADMIN_PASSWORD_HASH,
  STORAGE_ADMIN_AUTH,
} from '@/constants';
import { getRaw, setRaw, remove } from '@/utils/storage';
import { safeStringify, safeParseSchema } from '@/utils/json';
import type { Block, BlockType, CardRecord } from '@/types';

// JSON.stringify с отступами для предпросмотра схемы.
const stringifyPretty = (obj: unknown) => {
  try { return JSON.stringify(obj, null, 2); } catch { return ''; }
};

/** Конвертация ISO-строки в значение для <input type="datetime-local">. */
const toDatetimeLocalValue = (iso: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

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
  const [isActive, setIsActive] = useState(true);

  // Блоки на холсте.
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Список существующих карточек — для выбора и редактирования.
  const [existingCards, setExistingCards] = useState<Array<{ card_id: string; title: string; is_active: boolean }>>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState('');

  // Флаг "запрос уже в полёте" — защита от параллельных повторных вызовов getCardsList.
  const isFetchingRef = useRef(false);

  const toast = useToast();

  /** Проверка, авторизован ли в этой сессии. */
  useEffect(() => {
    const isAuthedNow = getRaw<boolean>(STORAGE_ADMIN_AUTH);
    if (isAuthedNow) setAuthed(true);
  }, []);

  /** Загрузить список карточек для редактирования (после авторизации). */
  const loadExistingCards = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setCardsLoading(true);
    try {
      const cards = await sheetsApi.getCardsList();
      setExistingCards(cards);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки карточек';
      toast.error(msg);
    } finally {
      setCardsLoading(false);
      isFetchingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authed) {
      loadExistingCards();
    }
  }, [authed, loadExistingCards]);

  /** Вход по паролю. */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthChecking(true);
    setAuthError('');
    try {
      if (!ADMIN_PASSWORD_HASH) {
        setAuthed(true);
        setRaw(STORAGE_ADMIN_AUTH, true);
        return;
      }
      const ok = await verifyPassword(password, ADMIN_PASSWORD_HASH);
      if (ok) {
        setAuthed(true);
        setRaw(STORAGE_ADMIN_AUTH, true);
        setPassword('');
      } else {
        setAuthError('Неверный пароль');
      }
    } catch (e) {
      setAuthError('Ошибка проверки пароля');
    } finally {
      setAuthChecking(false);
    }
  };

  /** Выход. */
  const handleLogout = () => {
    setAuthed(false);
    remove(STORAGE_ADMIN_AUTH);
  };

  /** Очистить форму и холст (создание карточки "с нуля"). */
  const resetForm = () => {
    setCardId('');
    setTitle('');
    setReleaseDatetime('');
    setPostId('');
    setIsActive(true);
    setBlocks([]);
    setSelectedId(null);
    setSelectedExistingId('');
  };

  /**
   * Загрузить выбранную карточку в форму для редактирования.
   * json_schema приходит из Sheets строкой — парсим её в массив blocks.
   */
  const loadCardIntoForm = async (cardIdToLoad: string) => {
    const card = await sheetsApi.getCard(cardIdToLoad);
    if (!card) {
      toast.error('Не удалось найти данные карточки');
      return;
    }
    setCardId(String(card.card_id));
    setTitle(card.title);
    setReleaseDatetime(toDatetimeLocalValue(card.release_datetime));
    setPostId(card.post_id || '');
    setIsActive(card.is_active !== false);

    const schema = safeParseSchema<{ blocks: Block[] }>(card.json_schema, { blocks: [] });
    setBlocks(schema.blocks || []);
    setSelectedId(null);
  };

  /**
   * Обработчик выбора карточки в селекторе редактирования.
   */
  const handleSelectExisting = (id: string) => {
    setSelectedExistingId(id);
    if (!id) {
      resetForm();
      return;
    }
    loadCardIntoForm(id);
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

  /** Сохранить карточку в Google Sheets (создание ИЛИ обновление по card_id). */
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
        is_active: isActive,
      };
      await sheetsApi.saveCard(card);
      const isEdit = existingCards.some((c) => String(c.card_id) === String(cardId));
      toast.success(isEdit ? 'Карточка обновлена!' : 'Карточка сохранена!');
      await loadExistingCards();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения';
      toast.error(msg);
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

      {/* Редактирование существующих карточек. */}
      <div className="card-surface mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Редактирование карточки
        </h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Выберите карточку для редактирования
            </label>
            <select
              className="input-field"
              value={selectedExistingId}
              onChange={(e) => handleSelectExisting(e.target.value)}
              disabled={cardsLoading}
            >
              <option value="">— Новая карточка —</option>
              {existingCards.map((c) => (
                <option key={String(c.card_id)} value={String(c.card_id)}>
                  {String(c.card_id)} — {c.title || '(без названия)'}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" onClick={loadExistingCards} disabled={cardsLoading}>
            Обновить список
          </Button>
          <Button variant="secondary" onClick={resetForm}>
            Новая карточка
          </Button>
        </div>
        {cardsLoading && (
          <p className="text-xs text-slate-400 mt-2">Загрузка карточек…</p>
        )}
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
            disabled={!!selectedExistingId}
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
        <label className="flex items-center gap-2 text-sm text-slate-700 mt-3">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Карточка активна (видна пользователям)
        </label>
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
        <Button onClick={handleSave}>
          {selectedExistingId ? 'Сохранить изменения' : 'Сохранить карточку'}
        </Button>
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