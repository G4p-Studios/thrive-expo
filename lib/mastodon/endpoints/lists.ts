import { get, post, del } from '../client';
import { mapList } from '../mappers';
import type { MastodonList } from '@/types/mastodon';

/**
 * Get all lists
 */
export async function getLists(): Promise<MastodonList[]> {
  const raw = await get<any[]>('/api/v1/lists');
  return raw.map(mapList);
}

/**
 * Create a new list
 */
export async function createList(title: string): Promise<MastodonList> {
  const raw = await post<any>('/api/v1/lists', { title });
  return mapList(raw);
}

/**
 * Delete a list
 */
export async function deleteList(listId: string): Promise<void> {
  await del(`/api/v1/lists/${encodeURIComponent(listId)}`);
}
