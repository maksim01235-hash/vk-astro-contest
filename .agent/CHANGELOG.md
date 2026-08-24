# Журнал изменений агента

## 2026-08-24 — Правка: refreshReposts проверяет и перезаписывает все записи

**Ветка:** `ai/fix-delta-reposts-notifications`
**Коммит:** ещё не создан
**Статус:** `готова`

### Что сделано

- По требованию владельца `refreshReposts` больше не пропускает совпадающие строки: вычисляется has_reposted для КАЖДОЙ записи Answers, вся колонка перезаписывается одним батчем setValues (быстрее построчных setValue). Поле updated в сводке теперь означает «сколько значений фактически изменилось» (диагностика), checked — сколько записей проверено/перезаписано.
- Тост кнопки переформулирован: «Проверено записей: N (изменилось M)…».
- docs/google-sheets-setup.md: описание приведено к новой семантике.

### Изменённые файлы

- `apps-script/Code.gs` — refreshReposts: батч-перезапись всей колонки
- `src/components/admin/RefreshRepostsButton.tsx` — текст сводки
- `docs/google-sheets-setup.md`, `.agent/CHANGELOG.md`

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Нет.

## 2026-08-24 — Задача 2: попап уведомлений скрыт на десктопе + глобальный флаг

**Ветка:** `ai/fix-delta-reposts-notifications`
**Коммит:** ещё не создан
**Статус:** `готова`

### Что сделано

- `useNotification`: попап не показывается на desktop_web (vk_platform из query запуска мини-аппа) — для немодерированных приложений запрос там всегда падает с client_error code 6.
- Новая переменная `NEXT_PUBLIC_DISABLE_NOTIFICATION_POPUP` (true/1) полностью запрещает попап на всех платформах: константа в constants, проверка в useNotification, упоминание в README (Шаг 5 + список секретов деплоя) и env-строка в `.github/workflows/deploy.yml`.
- Обработка ошибок bridge не менялась (сериализация error_type/error_data сохранена); поведение при отказе пользователя прежнее.

### Изменённые файлы

- `src/constants/index.ts` — DISABLE_NOTIFICATION_POPUP
- `src/lib/hooks/useNotification.ts` — isDesktopWeb + shouldSuppressPopup в checkShouldShow/showAfterSubmit
- `README.md`, `.github/workflows/deploy.yml` — документирование новой переменной

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Чтобы отключить попап в продакшене, добавить секрет NEXT_PUBLIC_DISABLE_NOTIFICATION_POPUP=true в GitHub (необязательно — на десктопе он теперь скрыт и без флага).

## 2026-08-24 — Задача 3: репосты без модалки, тихая проверка + полная перепроверка

**Ветка:** `ai/fix-delta-reposts-notifications`
**Коммит:** ещё не создан
**Статус:** `готова`

### Что сделано

- Удалены `RepostModal` и хук `useRepost`: модалка с побуждением к репосту убрана из потока целиком (решение владельца). `uiStore` оставлен — используется NotificationModal.
- Тихая проверка при отправке: в `handleSubmit` один вызов `checkRepost`, результат — в `answer.has_reposted`; офлайн/без post_id → false. Сбой проверки не блокирует ответ: `repost_fail reason=check_failed`; незаданный токен на сервере теперь различим (`REPOST_CHECK_NOT_CONFIGURED`) и пишется как `repost_check_unconfigured` один раз за сессию.
- Полная перепроверка: серверная функция `refreshReposts(passwordHash)` (проверка SHA-256 против Script Property ADMIN_PASSWORD_HASH, wall.getReposts по уникальным постам, точечное обновление только изменившихся ячеек под LockService) + POST-экшен; клиентский метод с таймаутом 30 c; кнопка «Перепроверить репосты» на /admin/stats с явным вводом пароля (не хранится).
- docs/google-sheets-setup.md: шаг 6 помечен обязательным для боевого режима, добавлен ADMIN_PASSWORD_HASH.

### Изменённые файлы

- `apps-script/Code.gs` — маркер REPOST_CHECK_NOT_CONFIGURED, refreshReposts + doPost-экшен
- `src/constants/index.ts` — REFRESH_REPOSTS
- `src/types/index.ts` — RepostRefreshSummary
- `src/lib/sheets/api.client.ts` — refreshReposts(), таймаут 30 c
- `src/components/admin/RefreshRepostsButton.tsx` — новый компонент
- `src/app/admin/stats/page.tsx` — кнопка в обеих шапках
- `src/app/quiz/page.tsx` — удалена модалка/хук, тихая проверка
- `src/components/quiz/RepostModal.tsx`, `src/lib/hooks/useRepost.ts` — удалены
- `docs/google-sheets-setup.md`, `.agent/CHANGELOG.md`

### Проверки

- `npm run lint` — успешно (только ранее существовавшие предупреждения)
- `npx tsc --noEmit` — успешно
- `npm run build` — успешно

### Требует внимания

- Для работы проверки/перепроверки задать Script Properties: VK_SERVICE_TOKEN, VK_OWNER_ID, ADMIN_PASSWORD_HASH; переиздать веб-приложение.
- Пароль админки запрашивается при каждом запуске перепроверки намеренно.

## 2026-08-24 — Задача 1: корректная delta_seconds при рассинхроне часов

**Ветка:** `ai/fix-delta-reposts-notifications`
**Коммит:** ещё не создан
**Статус:** `готова` (ожидает проверок/коммита)

### Что сделано

- Новый модуль `src/utils/serverClock.ts`: измеряет смещение серверных часов относительно устройства (`noteServerTime`, с компенсацией сетевой задержки по середине интервала) и отдаёт «серверное сейчас» (`getServerNowMs`).
- `useCard.ts`: калибровка вызывается при успешных `markCardOpen` и `getServerTime`.
- `quiz/page.tsx`: момент отправки считается через `getServerNowMs()` (офлайн-ветка — локальное время); защитный клэмп отрицательной дельты в 0 с диагностическим событием `api_error action=delta_clamped`.

### Изменённые файлы

- `src/utils/serverClock.ts` — новый модуль
- `src/lib/hooks/useCard.ts` — noteServerTime в двух точках
- `src/app/quiz/page.tsx` — submitMs по серверным часам + клэмп дельты
- `.agent/CHANGELOG.md` — этот журнал

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Ручной тест: сдвинуть системные часы на ~−60 c, открыть карточку и отправить ответ — дельта должна быть неотрицательной и корректной; в Logs появится `delta_clamped`, если клэмп сработал.

