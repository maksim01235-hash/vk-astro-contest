/**
 * lib/sheets/mockData.ts — тестовые данные для mock-режима.
 * Используются при NEXT_PUBLIC_MOCK_MODE=true.
 * Позволяют разрабатывать и просматривать UI без VK Bridge и Apps Script.
 */

import type { CardRecord, CardStat } from '@/types';

/** Тестовые карточки с разными блоками (включая DnD). */
export const mockCards: CardRecord[] = [
  {
    card_id: '1',
    title: 'Логическая задача: животные и зоны',
    release_datetime: '2024-01-01T00:00:00.000Z', // уже доступна
    post_id: '123',
    is_active: true,
    json_schema: JSON.stringify({
      blocks: [
        {
          id: 'b1',
          type: 'TextBlock',
          order: 0,
          content:
            '## Условие\nПеретащите **каждое животное** в правильную зону обитания.\n\nУ вас есть 3 зоны: **Лес**, **Океан**, **Пустыня**.',
        },
        {
          id: 'b2',
          type: 'ImageBlock',
          order: 1,
          src: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
          alt: 'Природа',
          width: 'full',
        },
        {
          id: 'b3',
          type: 'DragZone',
          order: 2,
          zoneId: 'forest',
          label: 'Лес',
          maxItems: 2,
        },
        {
          id: 'b4',
          type: 'DragZone',
          order: 3,
          zoneId: 'ocean',
          label: 'Океан',
          maxItems: 2,
        },
        {
          id: 'b5',
          type: 'DragZone',
          order: 4,
          zoneId: 'desert',
          label: 'Пустыня',
          maxItems: 2,
        },
        {
          id: 'b6',
          type: 'DragObject',
          order: 5,
          objectId: 'fox',
          label: 'Лиса',
          allowedZones: ['forest'],
        },
        {
          id: 'b7',
          type: 'DragObject',
          order: 6,
          objectId: 'whale',
          label: 'Кит',
          allowedZones: ['ocean'],
        },
        {
          id: 'b8',
          type: 'DragObject',
          order: 7,
          objectId: 'camel',
          label: 'Верблюд',
          allowedZones: ['desert'],
        },
        {
          id: 'b9',
          type: 'InputField',
          order: 8,
          label: 'Ваше имя (для бонуса)',
          placeholder: 'Введите имя',
          inputType: 'text',
          required: false,
          answerKey: 'user_name',
        },
        {
          id: 'b10',
          type: 'Button',
          order: 9,
          label: 'Отправить ответ',
          action: 'submit',
          variant: 'primary',
        },
      ],
    }),
  },
  {
    card_id: '2',
    title: 'Вопрос с текстовым ответом',
    release_datetime: '2024-01-01T00:00:00.000Z',
    post_id: '456',
    is_active: true,
    json_schema: JSON.stringify({
      blocks: [
        {
          id: 'b1',
          type: 'TextBlock',
          order: 0,
          content:
            '## Вопрос\nНазовите столицу **Австралии**.\n\nВведите ответ в поле ниже.',
        },
        {
          id: 'b2',
          type: 'InputField',
          order: 1,
          label: 'Ваш ответ',
          placeholder: 'Например, Сидней',
          inputType: 'text',
          required: true,
          answerKey: 'capital',
        },
        {
          id: 'b3',
          type: 'Button',
          order: 2,
          label: 'Отправить ответ',
          action: 'submit',
          variant: 'primary',
        },
      ],
    }),
  },
  {
    card_id: '3',
    title: 'Карточка откроется позже (locked)',
    release_datetime: '2099-12-31T23:59:59.000Z', // далеко в будущем
    post_id: '789',
    is_active: true,
    json_schema: JSON.stringify({ blocks: [] }),
  },
];

/** Тестовая статистика для /admin/stats. */
export const mockStats: CardStat[] = [
{
  card_id: '1',
  title: 'Логическая задача: животные и зоны',
  total_answers: 42,
  total_users: 50,
  subscribed_count: 0,
  subscribed_group_count: 0,
  pct_answered: 84,
  avg_delta: 187,
  min_delta: 45,
  max_delta: 612,
  reposted_count: 38,
},
{
  card_id: '2',
  title: 'Вопрос с текстовым ответом',
  total_answers: 28,
  total_users: 50,
  subscribed_count: 0,
  subscribed_group_count: 0,
  pct_answered: 56,
  avg_delta: 95,
  min_delta: 20,
  max_delta: 340,
  reposted_count: 25,
},
];
