/**
 * src/lib/vk/bridge.ts — инициализация и обёртка над VK Bridge.
 *
 * Диагностика уведомлений:
 * requestNotifications НЕ скрывает ошибку VK Bridge. Ошибка пробрасывается
 * в useNotification.ts, где будет записана вместе с полями error_type,
 * error_data и message в накопленный лог.
 */

import vkBridge from '@vkontakte/vk-bridge';
import type { VKUserInfo } from '@/types';
import { MOCK_MODE } from '@/constants';

let initialized = false;

export function initBridge(): void {
  if (MOCK_MODE || initialized) return;

  try {
    void vkBridge.send('VKWebAppInit', {});
    initialized = true;
  } catch (error) {
    console.warn('[vk-bridge] init failed:', error);
  }
}

export async function getUserInfo(): Promise<VKUserInfo | null> {
  if (MOCK_MODE) {
    return {
      id: '123456789',
      first_name: 'Тест',
      last_name: 'Пользователь',
      name: 'Тест Пользователь',
      photo_200: '',
      sex: 1,
    };
  }

  try {
    const data = await vkBridge.send('VKWebAppGetUserInfo', {});

    return {
      id: String(data.id),
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      photo_200: data.photo_200 || data.photo_100 || '',
      sex: data.sex,
    };
  } catch (error) {
    console.warn('[vk-bridge] getUserInfo failed:', error);
    return null;
  }
}

export async function checkRepost(vkId: string, postId: string): Promise<boolean> {
  if (MOCK_MODE) return true;

  try {
    const { sheetsApi } = await import('../sheets/api.client');
    return await sheetsApi.checkRepost(vkId, postId);
  } catch (error) {
    console.warn('[vk-bridge] checkRepost failed:', error);
    return false;
  }
}

/**
 * Запросить разрешение на уведомления.
 *
 * При ошибке намеренно пробрасывает raw error VK Bridge наверх, а не возвращает
 * false: useNotification сохранит подробности в лог, включая error_type и
 * error_data, чтобы можно было определить настоящую причину client_error.
 */
export async function requestNotifications(): Promise<boolean> {
  if (MOCK_MODE) return true;

  try {
    await vkBridge.send('VKWebAppAllowNotifications', {});
    return true;
  } catch (error) {
    console.warn('[vk-bridge] allowNotifications failed:', error);
    throw error;
  }
}

/**
 * Открыть системный диалог создания записи на стене пользователя.
 * Совместимо с установленной версией @vkontakte/vk-bridge.
 */
export async function addWallPost(postId: string): Promise<boolean> {
  if (MOCK_MODE) return true;

  try {
    await vkBridge.send('VKWebAppShowWallPostBox', {
      message: `Участвую в конкурсе! Пост конкурса: ${postId}`,
    });
    return true;
  } catch (error) {
    console.warn('[vk-bridge] addWallPost failed:', error);
    return false;
  }
}

export { vkBridge };