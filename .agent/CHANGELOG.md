# Журнал изменений агента

## 2026-08-25 — Задача 7 (аудит A7): мелкие кодовые исправления

**Ветка:** `ai/fix-audit-tasks`
**Коммит:** см. журнал git (коммит задачи)
**Статус:** `готово`

### Что сделано

- Подсказка события repost_check_unconfigured обновлена: «set VK_USER_TOKEN and VK_OWNER_ID» (сервисный токен не подходит — error 15).
- CardRenderer: при смене json_schema (другая карточка без размонтирования) сбрасываются inputsRef/dndRef/markerMovedRef и позиция метки — ответы больше не наследуются между карточками.
- Code.gs: у вложенного writeLog внутри saveAnswer добавлен комментарий о реентерабельности LockService в рамках одного исполнения и опасности разнесения функций.

### Изменённые файлы

- `src/app/quiz/page.tsx`, `src/components/quiz/CardRenderer.tsx`, `apps-script/Code.gs`, `.agent/CHANGELOG.md`

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Нет.

## 2026-08-25 — Задача 6 (аудит A3): crash-логи ErrorBoundary доходят до Sheets

**Ветка:** `ai/fix-audit-tasks`
**Коммит:** см. журнал git (коммит задачи)
**Статус:** `готово`

### Что сделано

- `logger.ts`: экспортирована `flushLogBufferNow()` — принудительная отправка буфера без порога по размеру (обёртка над flushOverflow; ошибки глотаются с console.warn, single-flight gate защищает от параллельных отправок).
- `ErrorBoundary.componentDidCatch`: после записи api_error вызывается fire-and-forget flushLogBufferNow — крашнувшийся пользователь больше не теряет краш-лог.

### Изменённые файлы

- `src/lib/sheets/logger.ts`, `src/components/ui/ErrorBoundary.tsx`, `.agent/CHANGELOG.md`

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Нет.

## 2026-08-25 — Задача 5 (аудит A2): замок карточек по серверным часам

**Ветка:** `ai/fix-audit-tasks`
**Коммит:** см. журнал git (коммит задачи)
**Статус:** `готово`

### Что сделано

- `utils/time.ts → isReleased()`: база сравнения — `getServerNowMs()` из utils/serverClock (offset измеряется по markCardOpen/getServerTime в useCard). Обе точки использования (главная: статус locked/available; квиз: экран «Карточка ещё не открыта») накрыты одной правкой. До первого измерения offset — локальные часы (прежнее поведение); форматирование/тексты не тронуты.

### Изменённые файлы

- `src/utils/time.ts`, `.agent/CHANGELOG.md`

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Нет.

## 2026-08-25 — Задача 4 (аудит A1): гейт админки при пустом хеше

**Ветка:** `ai/fix-audit-tasks`
**Коммит:** см. журнал git (коммит задачи)
**Статус:** `готово`

### Что сделано

- `admin/page.tsx`: при пустом NEXT_PUBLIC_ADMIN_PASSWORD_HASH вход невозможен ни с каким паролем — показывается «Админка не настроена: задайте NEXT_PUBLIC_ADMIN_PASSWORD_HASH», форма остаётся, флаг STORAGE_ADMIN_AUTH не пишется. Ранее первый операнд условия пускал в админку без секрета.
- `/admin/stats` (вход по localStorage-флагу, только графики) — не менялся; сценарий не деградировал.

### Изменённые файлы

- `src/app/admin/page.tsx`, `.agent/CHANGELOG.md`

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Нет.

## 2026-08-24 — Правка: наложение «Выполнено» в списке карточек на узких экранах

**Ветка:** `ai/fix-home-card-layout` → влита в `main`
**Коммит:** см. журнал git (создаётся в этом же коммите)
**Статус:** `готово`

### Что сделано

- Главная страница, строка карточки: плавная обтекаемая раскладка без брейкпоинтов — `flex flex-wrap items-center gap-x-4 gap-y-2`. Пока места хватает — один ряд, бейдж «Выполнено»/кнопка прижаты к правому краю (flex-1 у текстового блока); когда тексту тесно — переносятся строкой ниже под текст слева.
- Защита текста: заголовок `break-words line-clamp-2`, дата `truncate`, бейджу и кнопке `whitespace-nowrap`. Причина исходных наложений — непереносимые длинные слова при сжатии блока на узких экранах/крупном системном шрифте.

### Изменённые файлы

- `src/app/page.tsx` — классы контейнера и элементов строки карточки
- `.agent/CHANGELOG.md`

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Просмотр владельцем до коммита; визуальная проверка на ширинах 320–1024px (перенос должен происходить плавно, без пустой середины в ряду).

## 2026-08-24 — Документация: инструкция по user-токену через Authorization Code Flow

**Ветка:** `main` (по прямому указанию владельца, без отдельной ветки)
**Коммит:** ещё не создан
**Статус:** `готова`

### Что сделано

- docs/google-sheets-setup.md, шаг 6 полностью переписан: причина ошибки «token issued for another IP» (Implicit-токены привязаны к IP выдачи), таблица «где взять три значения» (ID приложения / защищённый ключ / код), пошаговые 6.1–6.5: получение code → обмен на access_token через защищённый ключ существующего приложения → вставка в свойство VK_USER_TOKEN → переиздание → проверка кнопкой. Добавлены типичные проблемы (redirect_uri, одноразовость кода, повтор при ошибке авторизации).
- Код проекта не менялся.

### Изменённые файлы

- `docs/google-sheets-setup.md`
- `.agent/CHANGELOG.md`

### Проверки

- Изменения только в документации; lint/tsc/build не требуются.

### Требует внимания

- Владельцу выполнить шаги 6.1–6.3 и переиздать Apps Script (6.4).

## 2026-08-24 — Правка: репосты через user-токен (VK error 15) + защита от затирания

**Ветка:** `ai/fix-reposts-user-token`
**Коммит:** ещё не создан
**Статус:** `готова`

### Что сделано

- Корневая причина «0 репостов» подтверждена владельцем: wall.getReposts требует права wall, которого нет у сервисного токена → VK отвечает error 15.
- Code.gs: новый `getWallToken()` — берёт Script Property VK_USER_TOKEN; при наличии только сервисного токена выбрасывает различимое REPOST_TOKEN_REQUIRED (fallback на сервисный сознательно убран, чтобы не получать немые нули). Общий хелпер `fetchReposters()` пробрасывает ошибку VK с кодом (`wall.getReposts[15]: …`).
- checkRepostViaVK и refreshReposts переведены на user-токен; в refreshReposts любая ошибка по посту прерывает операцию ДО записи — колонка has_reposted больше не затирается при сбоях VK.
- RefreshRepostsButton: понятные тексты для REPOST_TOKEN_REQUIRED и сырых ошибок VK.
- docs/google-sheets-setup.md, шаг 6 переписан: получение user-токена через Standalone-приложение (oauth.vk.com/authorize, scope=wall), свойства VK_USER_TOKEN / VK_OWNER_ID / ADMIN_PASSWORD_HASH, роль сервисного токена (только groups.isMember).

### Изменённые файлы

- `apps-script/Code.gs`
- `src/components/admin/RefreshRepostsButton.tsx`
- `docs/google-sheets-setup.md`, `.agent/CHANGELOG.md`

### Проверки

- Запускаются ниже (lint / tsc / build).

### Требует внимания

- Владельцу: получить user-токен (Standalone-приложение, scope=wall) и добавить свойство VK_USER_TOKEN; переиздать веб-приложение. До этого кнопка/проверка честно ответят REPOST_TOKEN_REQUIRED вместо нулей.

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

