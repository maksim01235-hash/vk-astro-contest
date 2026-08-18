/**
 * lib/vk/bridge.ts — инициализация и обёртка над VK Bridge.
 *
 * Исправления (август 2026):
 *  - В mock-режиме убран недоступный внешний placeholder-аватар,
 *    вызывавший ошибку GET https://via.placeholder.com/200 ERR_CONNECTION_CLOSED.
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
      // Не используем via.placeholder.com: сервис может быть недоступен.
      photo_200: '',
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
 * Проверяет, сделал ли пользователь репост поста через Apps Script.
 */
export async function checkRepost(
  vkId: string,
  postId: string,
): Promise<boolean> {
  if (MOCK_MODE) return true;
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