# VK Mini App для конкурса

Полноценное приложение для проведения конкурса с интерактивными карточками, drag-and-drop, логированием в Google Sheets и админ-конструктором.

## Что внутри

- **Фронтенд**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Бэкенд**: Google Sheets через Google Apps Script (REST API-прокси)
- **VK**: авторизация, репост, уведомления через VK Bridge
- **DnD**: @dnd-kit/core для перетаскивания объектов в зоны
- **Просмотр фото**: PhotoSwipe
- **Хостинг**: GitHub Pages (статический экспорт)

## Возможности

1. Авторизация через VK (VK Bridge)
2. Карточки конкурса с Markdown-условиями и фото
3. Drag-and-drop: перетаскивание объектов в зоны
4. Измерение времени решения (delta = submit - open)
5. Логирование всех действий в Google Sheets (таблица Logs)
6. Проверка репоста + модалка с кнопкой репоста
7. Попап уведомлений (VKWebappAllowNotifications)
8. Оффлайн-очередь ответов
9. Админ-конструктор карточек (drag-and-drop блоков)
10. Страница статистики с графиками (Recharts)

## Быстрый старт (для нетехнического пользователя)

### Шаг 1. Установите Node.js

1. Зайдите на [nodejs.org](https://nodejs.org)
2. Скачайте LTS-версию (20.x) и установите.
3. Проверьте: откройте терминал (Командная строка / Terminal) и введите:
   ```
   node -v
   npm -v
   ```
   Должны появиться номера версий.

### Шаг 2. Скачайте проект

1. Скачайте ZIP-архив проекта и распакуйте в папку (например, `vk-contest`).
2. Откройте терминал и перейдите в папку:
   ```
   cd путь/к/vk-contest
   ```

### Шаг 3. Установите зависимости

В терминале:
```
npm install
```

### Шаг 4. Настройте Google Sheets

Подробная инструкция: [docs/google-sheets-setup.md](docs/google-sheets-setup.md)

Кратко:
1. Создайте новый документ Google Sheets.
2. Откройте Extensions → Apps Script.
3. Скопируйте код из `apps-script/Code.gs`.
4. Запустите `setupSheets` (создаст листы).
5. Deploy → New deployment → Web app → Anyone.
6. Скопируйте URL веб-приложения.

### Шаг 5. Настройте переменные окружения

1. Создайте файл `.env.local` в корне проекта.
2. Вставьте переменные:
   ```
   NEXT_PUBLIC_SHEETS_API_URL=<URL из шага 4>
   NEXT_PUBLIC_VK_APP_ID=<ID приложения VK>
   NEXT_PUBLIC_ADMIN_PASSWORD_HASH=<SHA-256 хеш пароля>
   NEXT_PUBLIC_BASE_PATH=/vk-astro-contest
   NEXT_PUBLIC_MOCK_MODE=false
   ```

### Шаг 6. Запустите локально

```
npm run dev
```

Откройте [http://localhost:3000/vk-astro-contest](http://localhost:3000/vk-astro-contest).

Для разработки без VK включите mock-режим:
```
NEXT_PUBLIC_MOCK_MODE=true npm run dev
```

### Шаг 7. Зарегистрируйте VK Mini App

Подробно: [docs/vk-setup.md](docs/vk-setup.md)

Кратко:
1. Зайдите на [vk.com/dev](https://vk.com/dev) → My Apps → Create.
2. Укажите название и иконку.
3. В настройках укажите URL (пока localhost или будущий GitHub Pages URL).
4. Скопируйте ID приложения в `.env.local` → `NEXT_PUBLIC_VK_APP_ID`.

### Шаг 8. Задеплойте на GitHub Pages

Подробно: см. раздел "Деплой" ниже.

## Настройка админки

Пароль админки хранится как SHA-256-хеш.

1. Сгенерируйте хеш (в терминале):
   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('вашпароль').digest('hex'))"
   ```
   Замените `вашпароль` на свой пароль.
2. Скопируйте полученный hex.
3. Вставьте в `.env.local` → `NEXT_PUBLIC_ADMIN_PASSWORD_HASH`.

ВНИМАНИЕ: это защита от случайного доступа, НЕ криптографическая.
Хеш виден в собранном коде. Для реальной защиты нужен серверный секрет.

## Деплой на GitHub Pages

### Вариант A: автоматически через GitHub Actions

1. Создайте репозиторий на GitHub.
2. Запушьте код:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/ВАШ_НИК/vk-astro-contest.git
   git push -u origin main
   ```
3. В репозитории: Settings → Pages → Source = "GitHub Actions".
4. В Settings → Secrets and variables → Actions добавьте секреты:
   - `NEXT_PUBLIC_SHEETS_API_URL` — URL Apps Script
   - `NEXT_PUBLIC_ADMIN_PASSWORD_HASH` — хеш пароля
   - `NEXT_PUBLIC_BASE_PATH` — путь репозитория (например, `/vk-astro-contest`)
   - `NEXT_PUBLIC_MOCK_MODE` — `false`
   - `NEXT_PUBLIC_VK_APP_ID` — ID приложения VK
5. При пуше в main — автоматически соберётся и опубликуется.
6. Сайт будет на `https://ВАШ_НИК.github.io/vk-astro-contest/`.

### Вариант B: вручную через gh-pages

1. Установите gh-pages:
   ```
   npm install gh-pages --save-dev
   ```
2. Соберите:
   ```
   npm run build
   ```
3. Залейте:
   ```
   npm run deploy
   ```
4. В репозитории: Settings → Pages → Source = "gh-pages branch".

## Ограничения статического экспорта

1. **Динамические маршруты**: `/quiz/[id]` требует пребилда ID карточек.
   **Решение**: используется маршрут с query-параметром `/quiz?id=X`.
   Любая новая карточка, добавленная в Google Sheets, сразу доступна без пересборки.

2. **VK Bridge**: работает только внутри VK (приложение или vk.com).
   Вне VK используйте mock-режим.

3. **CORS**: Apps Script поддерживает ограниченные CORS-заголовки.
   Мы используем простые запросы (Content-Type: text/plain).

4. **Безопасность**: пароль админки и Apps Script URL видны в коде.
   Для production-защиты нужен серверный секрет + проверка подписи VK.

## Структура проекта

```
vk-astro-contest/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD для GitHub Pages
├── apps-script/
│   └── Code.gs                     # Google Apps Script (бэкенд)
├── docs/
│   ├── google-sheets-setup.md      # Инструкция по настройке Sheets
│   ├── vk-setup.md                 # Инструкция по настройке VK
│   └── json-schema-examples.md     # Примеры JSON-схем карточек
├── src/
│   ├── app/                        # страницы (App Router)
│   │   ├── layout.tsx              # корневой layout
│   │   ├── page.tsx                # главная (список карточек)
│   │   ├── quiz/
│   │   │   └── page.tsx            # карточка конкурса (/quiz?id=X)
│   │   ├── admin/
│   │   │   └── page.tsx            # админ-конструктор
│   │   ├── thanks/
│   │   │   └── page.tsx            # благодарность после отправки
│   │   └── feedback/
│   │       └── page.tsx            # обратная связь
│   ├── components/
│   │   ├── ui/                     # базовые UI-компоненты
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── quiz/                   # компоненты карточек
│   │   │   ├── CardRenderer.tsx
│   │   │   ├── DnDContainer.tsx
│   │   │   ├── RepostModal.tsx
│   │   │   ├── NotificationModal.tsx
│   │   │   ├── PhotoSwipeViewer.tsx
│   │   │   └── blocks/             # рендеры блоков
│   │   │       ├── TextBlock.tsx
│   │   │       ├── ImageBlock.tsx
│   │   │       ├── InputField.tsx
│   │   │       └── Button.tsx
│   │   ├── admin/                  # админ-конструктор
│   │   │   ├── Canvas.tsx
│   │   │   ├── BlockToolbar.tsx
│   │   │   ├── PropertiesPanel.tsx
│   │   │   ├── blockFactory.ts
│   │   │   └── AdminLogButton.tsx
│   │   └── common/                 # общие компоненты
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── Providers.tsx
│   ├── lib/
│   │   ├── hooks/                  # React-хуки
│   │   │   ├── useAuth.ts
│   │   │   ├── useCard.ts
│   │   │   ├── useLocalStorage.ts
│   │   │   ├── useRepost.ts
│   │   │   └── useNotification.ts
│   │   ├── store/                  # Zustand stores
│   │   │   ├── userStore.ts
│   │   │   └── cardsStore.ts
│   │   ├── sheets/                 # Google Sheets API
│   │   │   ├── api.client.ts
│   │   │   └── logger.ts
│   │   └── vk/                     # VK Bridge
│   │       └── bridge.ts
│   ├── types/
│   │   └── index.ts                # TypeScript-интерфейсы
│   ├── constants/
│   │   └── index.ts                # константы приложения
│   ├── utils/
│   │   ├── storage.ts              # localStorage утилиты
│   │   ├── time.ts                 # работа со временем
│   │   ├── json.ts                 # JSON утилиты
│   │   └── crypto.ts               # крипто-утилиты
│   └── styles/
│       └── globals.css             # глобальные стили
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env.local (не в git)
```

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Локальная разработка |
| `npm run build` | Сборка (static export в `out/`) |
| `npm run start` | Запуск продакшн-сборки локально |
| `npm run lint` | Проверка ESLint |
| `npm run typecheck` | Проверка типов TypeScript |
| `npm run deploy` | Сборка + деплой на gh-pages |

## Документация

- [Настройка Google Sheets](docs/google-sheets-setup.md)
- [Настройка VK Mini App](docs/vk-setup.md)
- [Примеры JSON-схем карточек](docs/json-schema-examples.md)

## Технологии

- Next.js 14 (App Router, static export)
- TypeScript
- Tailwind CSS
- @dnd-kit/core (drag-and-drop)
- React Hook Form + Zod (валидация)
- axios (HTTP с retry)
- Zustand (состояние)
- Recharts (графики)
- PhotoSwipe (просмотр изображений)
- @vkontakte/vk-bridge (VK)
- Google Apps Script (бэкенд-прокси)

## Обновления (август 2026)

- **Кеширование карточек**: CacheService на стороне Apps Script (TTL 5 мин).
- **Лёгкий список карточек**: новый action `getCardsList` (без json_schema) для админки.
- **Индекс строк**: быстрый updateRow для saveCard без полного readSheet.
- **Новая схема Logs**: старые строки — архив, новые — 3 столбца (vk_id, timestamp, log).
- **Логирование**: логи копятся в памяти, отправляются только вместе с ответом/фидбэком.
- **Динамические карточки**: `/quiz?id=X` вместо `/quiz/[id]` — новые карточки без пересборки.
- **DnD-объекты**: опциональный текст, положение текста (left/right/top/bottom), размер картинки (maxImageSize/imageSize).
- **Единый формат user_answer**: все ответы пишутся как полный JSON `{ inputs, dnd }` без схлопывания.
- **Серверная проверка ответов**: числовые InputField с `correctAnswer` (процентный допуск
  `tolerancePercent`) и DragZone со списком `correctObjectIds` проверяются в Apps Script —
  результат (`actualErrorPercent`/`isCorrect`, по-объектный для DnD) пишется в user_answer.
- **Редактируемые ID блоков**: `id`, `answerKey`, `zoneId`, `objectId` правятся в конструкторе;
  проверяется уникальность в своей области, сохранение блокируется при дублях/пустых значениях.

## Поток данных

1. **Авторизация**: `useAuth.ts` → VK Bridge (`getUserInfo`) → `checkUser` API → `userStore`
2. **Загрузка карточек**: `page.tsx` → `getCards` API → `cardsStore` → кеш в localStorage (5 мин)
3. **Открытие карточки**: `/quiz?id=X` → `useCard.ts` → `getCard` API → `CardRenderer.tsx`
4. **Отправка ответа**: `CardRenderer` → `handleSubmit` → `saveAnswer` API + логи → `/thanks`
5. **DnD**: `DnDContainer.tsx` → `@dnd-kit` → состояние в `dndRef` → отправка в ответе
6. **Админка**: `admin/page.tsx` → конструктор блоков → `saveCard` API → Google Sheets

## Формат ответа

- **Все карточки**: всегда полный JSON `{ inputs, dnd }`, включая пустое состояние
  и unassigned-объекты DnD. Схлопывания нет.
- **Карточка с маркером** (бэкенд): при наличии поля `marker` добавляется
  результат проверки `marker` (userX, userY, actualErrorPercent, isCorrect).