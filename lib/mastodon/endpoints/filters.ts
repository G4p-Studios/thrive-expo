import { get, post, put, del } from '../client';
import { mapFilter } from '../mappers';
import type { FilterAction, FilterContext, MastodonFilter } from '@/types/mastodon';

/**
 * A keyword as the editor holds it.
 *
 * `id` is present for keywords that already exist on the server; new ones have
 * none. `destroy` marks an existing keyword for removal on the next save.
 */
export interface FilterKeywordInput {
  id?: string;
  keyword: string;
  wholeWord?: boolean;
  destroy?: boolean;
}

export interface FilterInput {
  title: string;
  context: FilterContext[];
  filterAction?: FilterAction;
  /** Seconds until the filter expires; null or omitted means never. */
  expiresIn?: number | null;
  keywords?: FilterKeywordInput[];
}

/**
 * Rails nested attributes: each entry either creates a keyword, updates one by
 * `id`, or removes it with `_destroy`. Sent as a JSON array, which Rails parses
 * the same way as the bracketed form the docs show.
 */
function toKeywordAttributes(keywords: FilterKeywordInput[] | undefined) {
  return (keywords ?? [])
    // A blank new keyword is nothing to save; a blank existing one is a removal.
    .filter(k => k.destroy || k.keyword.trim().length > 0)
    .map(k => {
      const attributes: Record<string, unknown> = {};
      if (k.id) attributes.id = k.id;
      if (k.destroy) {
        attributes._destroy = true;
      } else {
        attributes.keyword = k.keyword.trim();
        attributes.whole_word = !!k.wholeWord;
      }
      return attributes;
    });
}

function toFilterBody(input: FilterInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    context: input.context,
  };

  if (input.filterAction) {
    body.filter_action = input.filterAction;
  }

  // `null` is meaningful here — it clears an existing expiry — so only an
  // undefined value is left out.
  if (input.expiresIn !== undefined) {
    body.expires_in = input.expiresIn;
  }

  const keywords = toKeywordAttributes(input.keywords);
  if (keywords.length > 0) {
    body.keywords_attributes = keywords;
  }

  return body;
}

/**
 * All of your filters.
 *
 * v2 filters group several keywords under one title; the v1 endpoint is
 * deprecated and not used here.
 */
export async function getFilters(): Promise<MastodonFilter[]> {
  const raw = await get<any[]>('/api/v2/filters');
  return (raw || []).map(mapFilter);
}

export async function getFilter(filterId: string): Promise<MastodonFilter> {
  const raw = await get<any>(`/api/v2/filters/${encodeURIComponent(filterId)}`);
  return mapFilter(raw);
}

export async function createFilter(input: FilterInput): Promise<MastodonFilter> {
  const raw = await post<any>('/api/v2/filters', toFilterBody(input));
  return mapFilter(raw);
}

export async function updateFilter(filterId: string, input: FilterInput): Promise<MastodonFilter> {
  const raw = await put<any>(`/api/v2/filters/${encodeURIComponent(filterId)}`, toFilterBody(input));
  return mapFilter(raw);
}

export async function deleteFilter(filterId: string): Promise<void> {
  await del(`/api/v2/filters/${encodeURIComponent(filterId)}`);
}
