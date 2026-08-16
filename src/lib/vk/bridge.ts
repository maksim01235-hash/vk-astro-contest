/**
 * lib/vk/bridge.ts — инициализация и обёртка над VK Bridge.
 *
 * VK Bridge — JS-интерфейс для общения с VK-клиентом (мобильное приложение,
 * веб-версия VK). Все вызовы VK-методов идут через vkBridge.send(method, params).
 *
 * ВАЖНО:
 *  - VK Bridge работает ТОЛЬКО внутри VK (приложение или vk.com).
 *  - Вне VK (локальная разработка, preview) вызовы не сработают.
 *  - При MOCK_MODE=true мы не вызываем VK Bridge, отдаём тестовые данные.
 *  - VKWebAppInit должен вызываться перед любыми другими методами.
 */

import vkBridge from '@vkontakte/vk-bridge';
import type { VKUserInfo } from '@/types';
import { MOCK_MODE } from '@/constants';

/** Флаг: инициализирован ли VK Bridge. */
let initialized = false;

/**
 * Инициализирует VK Bridge (VKWebAppInit).
 * Должна вызываться один раз при старте приложения.
 * В mock-режиме — no-op.
 */
export function initBridge(): void {
  if (MOCK_MODE || initialized) return;
  try {
    vkBridge.send('VKWebAppInit', {});
    initialized = true;
  } catch (e) {
    console.warn('[vk-bridge] init failed:', e);
  }
}

/**
 * Получает информацию о пользователе (VKWebAppGetUserInfo).
 * @returns VKUserInfo или null, если не внутри VK.
 */
export async function getUserInfo(): Promise<VKUserInfo | null> {
  if (MOCK_MODE) {
    return {
      id: '123456789',
      first_name: 'Тест',
      last_name: 'Пользователь',
      name: 'Тест Пользователь',
      photo_200: 'https://via.placeholder.com/200',
      sex: 1,
    };
  }
  try {
    const data = await vkBridge.send('VKWebAppGetUserInfo', {});
    const user: VKUserInfo = {
      id: String(data.id),
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      photo_200: data.photo_200 || data.photo_100 || '',
      sex: data.sex,
    };
    return user;
  } catch (e) {
    console.warn('[vk-bridge] getUserInfo failed:', e);
    return null;
  }
}

/**
 * Проверяет, сделал ли пользователь репост поста (wall.getReposts).
 *
 * ВАЖНОЕ ОГРАНИЧЕНИЕ:
 *  wall.getReposts требует VK service token и не может вызываться напрямую
 *  из статического фронта. Реальная проверка идёт через Apps Script
 *  (action=checkRepost), который использует VK API с токеном из Script Properties.
 *  Здесь — клиентский хелпер, который вызывает Apps Script.
 *
 * В mock-режиме всегда возвращает true (репост "уже сделан").
 *
 * @param vkId — ID пользователя
 * @param postId — ID поста (wall postId)
 * @returns true, если репост найден
 */
export async function checkRepost(
  vkId: string,
  postId: string,
): Promise<boolean> {
  if (MOCK_MODE) return true;
  // Реальная проверка — через Apps Script (action=checkRepost),
  // который вызывает VK API wall.getReposts с service token.
  try {
    const { sheetsApi } = await import('../sheets/api.client');
    return await sheetsApi.checkRepost(vkId, postId);
  } catch (e) {
    console.warn('[vk-bridge] checkRepost failed:', e);
    return false;
  }
}

/**
 * Запрос разрешения на уведомления (VKWebAppAllowNotifications).
 * @returns true, если пользователь разрешил.
 */
export async function requestNotifications(): Promise<boolean> {
  if (MOCK_MODE) return true;
  try {
    await vkBridge.send('VKWebAppAllowNotifications', {});
    return true;
  } catch (e) {
    console.warn('[vk-bridge] allowNotifications failed:', e);
    return false;
  }
}

/**
 * Сделать репост поста на стену (VKWebAppAddWallPost).
 * @param postId — ID поста для репоста
 * @returns true при успехе
 */
export async function addWallPost(postId: string): Promise<boolean> {
  if (MOCK_MODE) return true;
  try {
    await vkBridge.send('VKWebAppAddWallPost', {
      post_id: postId,
      message: 'Участвую в конкурсе!',
    });
    return true;
  } catch (e) {
    console.warn('[vk-bridge] addWallPost failed:', e);
    return false;
  }
}

export { vkBridge };
