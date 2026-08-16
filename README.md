# VK Mini App для конкурса

Полноценное приложение для проведения конкурса с интерактивными карточками, drag-and-drop, логированием в Google Sheets и админ-конструктором.

## Что внутри

- **Фронтенд**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Бэкенд**: Google Sheets через Google Apps Script (REST API-прокси)
- **VK**: авторизация, репост, уведомления через VK Bridge
- **DnD**: @dnd-kit для перетаскивания объектов в зоны
- **Хостинг**: GitHub Pages (статический экспорт)

## Возможности

1. Авторизация через VK (VK Bridge)
2. Карточки конкурса с Markdown-условиями и фото
3. Drag-and-drop: перетаскивание объектов в зоны
4. Измерение времени решения (delta = submit - open)
5. Логирование всех действий в Google Sheets (таблица Logs)
6. Проверка репоста + модалка с кнопкой репоста
7. Попап уведомлений (VKWebAppAllowNotifications)
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

1. Скопируйте `.env.example` в `.env.local`:
   ```
   cp .env.example .env.local
   ```
2. Откройте `.env.local` в любом текстовом редакторе.
3. Вставьте URL из шага 4 в `NEXT_PUBLIC_SHEETS_API_URL`.
4. Задайте хеш пароля админки (см. ниже).

### Шаг 6. Запустите локально

```
npm run dev
```

Откройте [http://localhost:3000/vk-contest-mini-app](http://localhost:3000/vk-contest-mini-app).

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
   ```
   node -e "require('crypto').createHash('sha256').update('вашпароль').digest('hex').split('').forEach(c=>process.stdout.write(c))"
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
   git remote add origin https://github.com/ВАШ_НИК/vk-contest-mini-app.git
   git push -u origin main
   ```
3. В репозитории: Settings → Pages → Source = "GitHub Actions".
4. В Settings → Secrets and variables → Actions добавьте секреты:
   - `NEXT_PUBLIC_SHEETS_API_URL` — URL Apps Script
   - `NEXT_PUBLIC_ADMIN_PASSWORD_HASH` — хеш пароля
   - `NEXT_PUBLIC_BASE_PATH` — путь репозитория (например, `/vk-contest-mini-app`)
   - `NEXT_PUBLIC_PREBUILD_CARD_IDS` — ID карточек (например, `1,2,3`)
   - `NEXT_PUBLIC_MOCK_MODE` — `false`
5. При пуше в main — автоматически соберётся и опубликуется.
6. Сайт будет на `https://ВАШ_НИК.github.io/vk-contest-mini-app/`.

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

1. **Динамические маршруты**: `/quiz/[id]` требует пребилда ID карточек
   (через `NEXT_PUBLIC_PREBUILD_CARD_IDS`). Новые карточки после деплоя
   требуют пересборку. Альтернатива: использовать `/quiz?id=X`.

2. **VK Bridge**: работает только внутри VK (приложение или vk.com).
   Вне VK используйте mock-режим.

3. **CORS**: Apps Script поддерживает ограниченные CORS-заголовки.
   Мы используем простые запросы (Content-Type: text/plain).

4. **Безопасность**: пароль админки и Apps Script URL видны в коде.
   Для production-защиты нужен серверный секрет + проверка подписи VK.

## Структура проекта

```
vk-contest-mini-app/
├── src/
│   ├── app/                    # страницы (App Router)
│   │   ├── layout.tsx          # корневой layout
│   │   ├── page.tsx            # главная (список карточек)
│   │   ├── quiz/[id]/         # карточка конкурса
│   │   ├── admin/             # админ-конструктор
│   │   │   └── stats/        # статистика
│   │   ├── thanks/            # благодарность
│   │   └── feedback/         # обратная связь
│   ├── components/
│   │   ├── ui/                # Button, Input, Modal, Toast, ErrorBoundary
│   │   ├── quiz/              # CardRenderer, DnDContainer, блоки
│   │   ├── admin/             # BlockToolbar, Canvas, PropertiesPanel
│   │   └── common/            # Header, Footer, Providers
│   ├── lib/
│   │   ├── vk/                # bridge.ts (VK Bridge обёртка)
│   │   ├── sheets/            # api.client.ts, logger.ts, mockData.ts
│   │   ├── store/             # Zustand: userStore, cardsStore
│   │   └── hooks/             # useAuth, useCard, useRepost, useNotification
│   ├── types/                 # TypeScript-интерфейсы
│   ├── constants/             # все константы
│   ├── utils/                 # storage, time, json, crypto
│   └── styles/                # globals.css
├── apps-script/
│   └── Code.gs                # Google Apps Script (бэкенд)
├── docs/                      # инструкции
├── .github/workflows/         # CI/CD для GitHub Pages
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env.example
```

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Локальная разработка |
| `npm run build` | Сборка (static export в `out/`) |
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
- @dnd-kit (drag-and-drop)
- React Hook Form + Zod (валидация)
- axios (HTTP с retry)
- Zustand (состояние)
- Recharts (графики)
- @vkontakte/vk-bridge (VK)
- Google Apps Script (бэкенд-прокси)
