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
4. В логе выполнения увидите: "Sheets initialized: Users, Cards, Answers, Logs, Feedback".
5. Вернитесь в Google Sheets — там появятся 5 листов с заголовками:
   - **Users**: vk_id | name | reg_date | subscribed | last_activity
   - **Cards**: card_id | title | release_datetime | post_id | json_schema | is_active
   - **Answers**: id | vk_id | card_id | open_timestamp | submit_timestamp | delta_seconds | user_answer | has_reposted
   - **Logs**: id | timestamp | vk_id | event_type | event_data | page_url | user_agent
   - **Feedback**: id | timestamp | vk_id | name | card_id | message

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

## Шаг 6. (Опционально) Включите проверку репостов

Для проверки репостов через VK API нужен service token:

1. Создайте VK-приложение (см. [vk-setup.md](vk-setup.md)).
2. В настройках приложения найдите **Service token**.
3. Узнайте **ID владельца стены** (где опубликован пост конкурса):
   - Для группы: ID группы с минусом (например, `-123456`).
   - Для пользователя: ID пользователя.
4. В редакторе Apps Script: **Файл → Свойства проекта → Свойства скрипта**.
5. Добавьте свойства:
   - `VK_SERVICE_TOKEN` = ваш service token из VK.
   - `VK_OWNER_ID` = ID владельца стены (например, `-123456`).
6. Сохраните.

Без этого проверка репостов будет возвращать false (модалка появится всегда).

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