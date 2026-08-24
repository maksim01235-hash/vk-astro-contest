# Настройка Google Sheets (пошагово)

Google Sheets работает как база данных. Доступ идёт через Google Apps Script,
который публикуется как веб-приложение (REST API).

## Шаг 1. Создайте документ Google Sheets

1. Откройте [sheets.new](https://sheets.new) (создаст новый документ).
2. Назовите его, например, "Конкурс VK".

## Шаг 2. Откройте Apps Script

1. В меню Google Sheets: **Extensions → Apps Script**.
2. Откроется редактор скриптов в новой вкладке.

## Шаг 3. Вставьте код

1. Удалите весь код в редакторе (там будет `function myFunction() {}`).
2. Откройте файл `apps-script/Code.gs` из этого проекта (в текстовом редакторе).
3. Скопируйте ВСЁ содержимое `Code.gs`.
4. Вставьте в редактор Apps Script.

## Шаг 4. Создайте листы (запустите setupSheets)

1. В редакторе Apps Script выберите функцию `setupSheets` в выпадающем списке
   (где по умолчанию выбрано `doGet`).
2. Нажмите кнопку **Run** (▶).
3. При первом запуске Google попросит разрешения:
   - Нажмите **Review permissions**.
   - Выберите свой аккаунт.
   - Нажмите **Advanced → Go to project (unsafe)**.
   - Нажмите **Allow**.
4. В логе выполнения увидите: "Sheets initialized: Users, Cards, Answers, Logs, Feedback, Opens".
5. Вернитесь в Google Sheets — там появятся 6 листов с заголовками:
   - **Users**: vk_id | name | reg_date | subscribed | last_activity
   - **Cards**: card_id | title | release_datetime | post_id | json_schema | is_active
   - **Answers**: id | vk_id | card_id | open_timestamp | submit_timestamp | delta_seconds | user_answer | has_reposted
   - **Logs**: vk_id | timestamp | log (вся пачка событий одной JSON-строкой)
   - **Feedback**: id | timestamp | vk_id | name | card_id | message
   - **Opens**: vk_id | card_id | first_open_timestamp

   Если лист Logs уже существовал со старыми заголовками — переименуйте его
   в `Logs_archive` и запустите `setupSheets` заново: будет создан лист
   с актуальными колонками. Старые строки останутся в архиве.

## Шаг 5. Опубликуйте как веб-приложение

1. В редакторе Apps Script: **Deploy → New deployment**.
2. Нажмите шестерёнку → **Web app**.
3. Настройки:
   - **Description**: "VK Contest API"
   - **Execute as**: **Me** (выполняется от вашего имени)
   - **Who has access**: **Anyone** (доступ для всех — нужно для статического фронта)
4. Нажмите **Deploy**.
5. При необходимости дайте разрешения (как в шаге 4).
6. Появится окно с **Web app URL** — скопируйте его.
   - Пример: `https://script.google.com/macros/s/AKfycb.../exec`
7. Этот URL вставьте в `.env.local` → `NEXT_PUBLIC_SHEETS_API_URL`.

## Шаг 6. (ОБЯЗАТЕЛЬНО для боевого режима) Проверка репостов и перепроверка

Без этого шага проверка репостов фактически отключена: при отправке ответа
`has_reposted` всегда пишется как FALSE, а в логах появляется событие
`repost_check_unconfigured`.

**Важно:** метод VK `wall.getReposts` требует права доступа `wall`, которого
у **сервисного токена нет** — он отвечает error 15 «Access denied».
Нужен **user-токен**.

### 6.1. Получите user-токен со scope=wall

1. В [vk.com/dev](https://vk.com/dev) создайте (или используйте) приложение
   типа **Standalone** — отдельный тип приложения, не Mini App.
2. Под аккаунтом владельца группы откройте в браузере ссылку (подставьте ID
   своего Standalone-приложения):
   ```
   https://oauth.vk.com/authorize?client_id=<ID_STANDALONE>&display=page&scope=wall&response_type=token&v=5.199
   ```
3. Разрешите доступ к стене; из адресной строки скопируйте параметр
   `access_token=...`.
4. Токен живёт до смены пароля/отзыва доступа — храните только в свойствах
   скрипта, нигде больше.

### 6.2. Задайте свойства скрипта

**Файл → Свойства проекта → Свойства скрипта:**

- `VK_USER_TOKEN` = user-токен из 6.1 (**обязателен для проверки репостов**);
- `VK_OWNER_ID` = ID владельца стены с постами конкурса (для группы —
  отрицательный, например `-123456`);
- `ADMIN_PASSWORD_HASH` = тот же SHA-256 хеш пароля админки, что в
  `NEXT_PUBLIC_ADMIN_PASSWORD_HASH` фронтенда — нужен для кнопки
  «Перепроверить репосты»;
- `VK_SERVICE_TOKEN` — можно оставить: он используется для `groups.isMember`
  (подписчики группы), но в проверке репостов больше не участвует.

### 6.3. Переиздайте веб-приложение

Deploy → Manage deployments → карандаш → **New version**.

Кнопка «Перепроверить репосты» (/admin/stats) пересчитывает has_reposted во
всех ответах по факту: пользователь мог репостнуть позже отправки. Проверяется
и перезаписывается каждая запись Answers (один батч), повторный вызов
идемпотентен. При любой ошибке VK колонка НЕ перезаписывается, а точная
ошибка показывается в тосте.

## Шаг 7. Проверьте, что API работает

1. Вставьте в браузер URL с параметром:
   ```
   https://script.google.com/macros/s/AKfycb.../exec?action=getCards
   ```
2. Должны увидеть JSON: `{"ok":true,"data":[]}` (пока пусто, карточек нет).

## Шаг 8. Добавьте тестовую карточку

### Вариант A: через админку

1. Запустите приложение локально: `npm run dev`.
2. Откройте `/admin`, введите пароль.
3. Создайте карточку и нажмите "Сохранить".

### Вариант B: вручную в Google Sheets

1. Откройте лист **Cards**.
2. Добавьте строку:
   - card_id: `1`
   - title: `Тестовая карточка`
   - release_datetime: `2024-01-01T00:00:00.000Z`
   - post_id: `123`
   - json_schema: вставьте пример из [json-schema-examples.md](json-schema-examples.md)
   - is_active: `TRUE`

## Обновление скрипта

Если вы изменили `Code.gs`:
1. В редакторе Apps Script: **Deploy → Manage deployments**.
2. Выберите ваше развёртывание → иконка карандаша.
3. **Version**: New version.
4. Нажмите **Deploy**.

URL останется тем же.

## Частые проблемы

### CORS-ошибка в браузере

Apps Script поддерживает ограниченные CORS-заголовки. Мы используем
простые запросы (Content-Type: text/plain), чтобы избежать preflight.
Если видите CORS-ошибку — проверьте, что фронт использует `text/plain`
(см. `src/lib/sheets/api.client.ts`).

### Ошибка "Authorization required"

При каждом обновлении скрипта нужно заново давать разрешения.
**Deploy → Manage deployments → карандаш → Deploy**.

### Скрипт не возвращает данные

Проверьте, что листы созданы (запустите `setupSheets`).
Проверьте URL — должен заканчиваться на `/exec?action=...`.