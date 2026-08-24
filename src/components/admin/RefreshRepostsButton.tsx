/**
 * src/components/admin/RefreshRepostsButton.tsx — кнопка полной перепроверки
 * репостов (пересчёт Answers.has_reposted по факту через wall.getReposts).
 *
 * Авторизация — явный ввод пароля админки на каждый запуск: пароль нигде не
 * хранится, STORAGE_ADMIN_AUTH источником пароля не является. На сервер уходит
 * только SHA-256 хеш (см. utils/crypto.ts).
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { sheetsApi } from '@/lib/sheets/api.client';
import { sha256 } from '@/utils/crypto';

/** Понятные тексты для различимых ошибок сервера. */
const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Неверный пароль',
  ADMIN_HASH_NOT_CONFIGURED:
    'Задайте свойство ADMIN_PASSWORD_HASH в Apps Script (тот же хеш, что в NEXT_PUBLIC_ADMIN_PASSWORD_HASH)',
  REPOST_CHECK_NOT_CONFIGURED:
    'Проверка репостов не настроена: задайте VK_OWNER_ID и VK_USER_TOKEN в свойствах скрипта',
  REPOST_TOKEN_REQUIRED:
    'Сервисный токен не подходит для wall.getReposts (VK отдаёт error 15). Добавьте свойство VK_USER_TOKEN — user-токен со scope=wall; как получить: docs/google-sheets-setup.md, шаг 6',
};

export function RefreshRepostsButton() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const run = async () => {
    if (!password.trim() || busy) return;

    setBusy(true);
    try {
      const hash = await sha256(password);
      const summary = await sheetsApi.refreshReposts(hash);
      const postsDetail = summary.posts
        .map((item) => `${item.post_id}: ${item.reposts}`)
        .join(', ');
      toast.success(`Проверено записей: ${summary.checked} (изменилось ${summary.updated}). Репостов по постам — ${postsDetail || 'нет постов'}`);
      setOpen(false);
      setPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка проверки';
      const knownKey = Object.keys(ERROR_MESSAGES).find((key) => message.includes(key));
      toast.error(knownKey ? ERROR_MESSAGES[knownKey] : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Перепроверить репосты
      </Button>

      <Modal
        open={open}
        onClose={() => { if (!busy) setOpen(false); }}
        title="Полная перепроверка репостов"
      >
        <p className="text-sm text-slate-600 mb-3">
          Пересчитать has_reposted во всех ответах по фактическим репостам VK
          (wall.getReposts по каждому посту конкурса). Обновляются только
          изменившиеся строки. Введите пароль админки.
        </p>
        <Input
          label="Пароль админки"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Пароль"
        />
        <div className="flex items-center gap-2 mt-4">
          <Button onClick={run} loading={busy} disabled={!password.trim()}>
            Запустить
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            Отмена
          </Button>
        </div>
      </Modal>
    </>
  );
}
