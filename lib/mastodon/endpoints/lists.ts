import { get, post, del, put } from '../client';
import { mapList, mapAccount } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonList, MastodonAccount } from '@/types/mastodon';

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
 * Update a list
 */
export async function updateList(listId: string, title: string): Promise<MastodonList> {
  const raw = await put<any>(`/api/v1/lists/${encodeURIComponent(listId)}`, { title });
  return mapList(raw);
}

/**
 * Delete a list
 */
export async function deleteList(listId: string): Promise<void> {
  await del(`/api/v1/lists/${encodeURIComponent(listId)}`);
}

/**
 * Get accounts in a list
 */
export async function getListAccounts(listId: string, maxId?: string): Promise<{ accounts: MastodonAccount[]; nextMaxId: string | null }> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>(`/api/v1/lists/${encodeURIComponent(listId)}/accounts`, {
    max_id: maxId,
    limit: '40',
  });
  const accounts = raw.map((a) => mapAccount(a, instanceUrl));
  const nextMaxId = accounts.length > 0 ? accounts[accounts.length - 1].id : null;
  return { accounts, nextMaxId };
}

/**
 * Add accounts to a list
 */
export async function addAccountsToList(listId: string, accountIds: string[]): Promise<void> {
  await post<any>(`/api/v1/lists/${encodeURIComponent(listId)}/accounts`, {
    account_ids: accountIds,
  });
}

/**
 * Remove accounts from a list
 */
export async function removeAccountsFromList(listId: string, accountIds: string[]): Promise<void> {
  await del(`/api/v1/lists/${encodeURIComponent(listId)}/accounts`);
}
