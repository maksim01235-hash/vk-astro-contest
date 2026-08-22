'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BlockToolbar } from '@/components/admin/BlockToolbar';
import { Canvas } from '@/components/admin/Canvas';
import { PropertiesPanel } from '@/components/admin/PropertiesPanel';
import { AdminLogButton } from '@/components/admin/AdminLogButton';
import { createBlock } from '@/components/admin/blockFactory';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { sheetsApi } from '@/lib/sheets/api.client';
import { verifyPassword } from '@/utils/crypto';
import { ADMIN_PASSWORD_HASH, STORAGE_ADMIN_AUTH } from '@/constants';
import { getRaw, setRaw, remove } from '@/utils/storage';
import { safeStringify, safeParseSchema } from '@/utils/json';
import type { Block, BlockType, CardRecord } from '@/types';

const stringifyPretty = (value: unknown) => {
  try { return JSON.stringify(value, null, 2); } catch { return ''; }
};

const toDatetimeLocalValue = (iso: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authChecking, setAuthChecking] = useState(false);
  const [cardId, setCardId] = useState('');
  const [title, setTitle] = useState('');
  const [releaseDatetime, setReleaseDatetime] = useState('');
  const [postId, setPostId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [existingCards, setExistingCards] = useState<Array<{ card_id: string; title: string; is_active: boolean }>>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [showJson, setShowJson] = useState(false);
  const isFetchingRef = useRef(false);
  const toast = useToast();

  useEffect(() => { if (getRaw<boolean>(STORAGE_ADMIN_AUTH)) setAuthed(true); }, []);

  const loadExistingCards = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setCardsLoading(true);
    try { setExistingCards(await sheetsApi.getCardsList()); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка загрузки карточек'); }
    finally { setCardsLoading(false); isFetchingRef.current = false; }
  }, [toast]);

  useEffect(() => { if (authed) void loadExistingCards(); }, [authed, loadExistingCards]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setAuthChecking(true); setAuthError('');
    try {
      if (!ADMIN_PASSWORD_HASH || await verifyPassword(password, ADMIN_PASSWORD_HASH)) {
        setAuthed(true); setRaw(STORAGE_ADMIN_AUTH, true); setPassword('');
      } else setAuthError('Неверный пароль');
    } catch { setAuthError('Ошибка проверки пароля'); }
    finally { setAuthChecking(false); }
  };

  const resetForm = () => { setCardId(''); setTitle(''); setReleaseDatetime(''); setPostId(''); setIsActive(true); setBlocks([]); setSelectedId(null); setSelectedExistingId(''); };
  const loadCardIntoForm = async (id: string) => {
    const card = await sheetsApi.getCard(id);
    if (!card) { toast.error('Не удалось найти данные карточки'); return; }
    setCardId(String(card.card_id)); setTitle(card.title); setReleaseDatetime(toDatetimeLocalValue(card.release_datetime)); setPostId(card.post_id || ''); setIsActive(card.is_active !== false);
    const schema = safeParseSchema<{ blocks: Block[] }>(card.json_schema, { blocks: [] });
    setBlocks(schema.blocks || []); setSelectedId(null);
  };
  const handleSelectExisting = (id: string) => { setSelectedExistingId(id); if (!id) resetForm(); else void loadCardIntoForm(id); };
  const addBlock = (type: BlockType) => { const block = createBlock(type, blocks.length); setBlocks([...blocks, block]); setSelectedId(block.id); };
  const updateBlock = (updated: Block) => setBlocks(blocks.map((block) => block.id === updated.id ? updated : block));
  const handleSave = async () => {
    if (!cardId || !title) { toast.error('Заполните ID и название карточки'); return; }
    try {
      const card: CardRecord = { card_id: cardId, title, release_datetime: releaseDatetime ? new Date(releaseDatetime).toISOString() : new Date().toISOString(), post_id: postId, json_schema: safeStringify({ blocks }), is_active: isActive };
      await sheetsApi.saveCard(card); toast.success(existingCards.some((item) => String(item.card_id) === String(cardId)) ? 'Карточка обновлена!' : 'Карточка сохранена!'); await loadExistingCards();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка сохранения'); }
  };

  if (!authed) return <div className="flex flex-col items-center justify-center py-20 animate-fade-in"><div className="card-surface w-full max-w-md"><h1 className="mb-4 text-center text-2xl font-bold text-slate-900">Вход в админку</h1><form onSubmit={handleLogin} className="flex flex-col gap-4"><Input label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" error={authError || undefined} /><Button type="submit" loading={authChecking}>Войти</Button></form></div></div>;

  return <div className="animate-fade-in"><div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-bold text-slate-900">Конструктор карточек</h1><div className="flex items-center gap-2"><AdminLogButton page="admin" /><Link href="/admin/stats" className="btn-secondary text-sm">Статистика</Link><Button variant="secondary" size="sm" onClick={() => { setAuthed(false); remove(STORAGE_ADMIN_AUTH); }}>Выйти</Button></div></div>
    <div className="card-surface mb-4"><h3 className="mb-3 text-sm font-semibold text-slate-700">Редактирование карточки</h3><div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"><div className="flex flex-1 flex-col gap-1.5"><label className="text-sm font-medium text-slate-700">Выберите карточку для редактирования</label><select className="input-field" value={selectedExistingId} onChange={(e) => handleSelectExisting(e.target.value)} disabled={cardsLoading}><option value="">— Новая карточка —</option>{existingCards.map((card) => <option key={String(card.card_id)} value={String(card.card_id)}>{String(card.card_id)} — {card.title || '(без названия)'}</option>)}</select></div><Button variant="secondary" onClick={loadExistingCards} disabled={cardsLoading}>Обновить список</Button><Button variant="secondary" onClick={resetForm}>Новая карточка</Button></div>{cardsLoading && <p className="mt-2 text-xs text-slate-400">Загрузка карточек…</p>}</div>
    <div className="card-surface mb-4"><h3 className="mb-3 text-sm font-semibold text-slate-700">Параметры карточки</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input label="ID карточки" value={cardId} onChange={(e) => setCardId(e.target.value)} placeholder="1" disabled={!!selectedExistingId} /><Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Логическая задача" /><Input label="Дата/время открытия" type="datetime-local" value={releaseDatetime} onChange={(e) => setReleaseDatetime(e.target.value)} /><Input label="ID поста (для репоста)" value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="123" /></div><label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />Карточка активна (видна пользователям)</label></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div><BlockToolbar onAdd={addBlock} /></div><div><Canvas blocks={blocks} onChange={setBlocks} selectedId={selectedId} onSelect={setSelectedId} /></div><div><PropertiesPanel block={blocks.find((block) => block.id === selectedId) || null} onChange={updateBlock} /></div></div>
    <div className="mt-4 flex items-center gap-3"><Button onClick={handleSave}>{selectedExistingId ? 'Сохранить изменения' : 'Сохранить карточку'}</Button><Button variant="secondary" onClick={() => setShowJson((value) => !value)}>{showJson ? 'Скрыть JSON' : 'Показать JSON'}</Button></div>{showJson && <pre className="card-surface mt-4 max-h-96 overflow-y-auto overflow-x-auto text-xs text-slate-700">{stringifyPretty({ blocks })}</pre>}
  </div>;
}
