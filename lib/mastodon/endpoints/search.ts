import { get } from '../client';
import { mapSearchResponse } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { SearchResponse } from '@/types/mastodon';

/**
 * Search for accounts, statuses, and hashtags
 */
export async function search(
  query: string,
  type?: 'accounts' | 'statuses' | 'hashtags'
): Promise<SearchResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any>('/api/v2/search', {
    q: query,
    type,
    limit: '20',
  });

  return mapSearchResponse(raw, instanceUrl);
}
