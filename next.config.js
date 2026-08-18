/**
 * next.config.js — конфигурация Next.js для статического экспорта на GitHub Pages.
 *
 * ВАЖНО:
 *  - output: 'export' — генерирует статический сайт в папке `out/`.
 *  - images.unoptimized: true — на GitHub Pages нет серверной оптимизации картинок.
 *  - basePath — путь репозитория на GitHub Pages вида `/<repo-name>`.
 *    Например, для https://username.github.io/vk-contest-mini-app/ basePath = '/vk-contest-mini-app'.
 *    Для пользовательского домена или корня — basePath = ''.
 *  - trailingSlash: true — GitHub Pages корректно отдаёт папки с index.html.
 *
 * Обновления (август 2026):
 *  - Удалены упоминания NEXT_PUBLIC_PREBUILD_CARD_IDS (больше не нужен).
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Статический экспорт: папка `out` заливается на GitHub Pages.
  output: 'export',

  // Отключаем серверную оптимизацию изображений (статический хостинг).
  images: {
    unoptimized: true,
  // Разрешаем удалённые картинки из VK и других источников.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  // basePath = путь репозитория на GitHub Pages.
  // Меняйте под свой репозиторий. Для корневого домена — пустая строка.
  // Читается из env NEXT_PUBLIC_BASE_PATH, по умолчанию '/vk-contest-mini-app'.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/vk-contest-mini-app',

  // Добавляет слэш в конце URL — нужно для корректной работы на GitHub Pages.
  trailingSlash: true,

  // React strict mode — выявляет потенциальные проблемы в разработке.
  reactStrictMode: true,

  // ESLint не блокирует сборку (предупреждения, а не ошибки).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;