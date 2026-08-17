import { get, post, del } from '../client';
import { mapTag } from '../mappers';
import type { MastodonTag } from '@/types/mastodon';

/**
 * A hashtag pinned to a profile.
 *
 * Distinct from a plain tag: `id` identifies the featuring, not the hashtag,
 * and is what removal is keyed on.
 */
export interface FeaturedTag {
  id: string;
  /** Without the leading hash. */
  name: string;
  url: string;
  statusesCount: number;
  /** Empty when the tag has never been used. */
  lastStatusAt: string;
}

function mapFeaturedTag(raw: any): FeaturedTag {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    url: raw.url ?? '',
    statusesCount: raw.statuses_count ?? 0,
    lastStatusAt: raw.last_status_at ?? '',
  };
}

/**
 * Hashtags featured on your own profile.
 */
export async function getFeaturedTags(): Promise<FeaturedTag[]> {
  const raw = await get<any[]>('/api/v1/featured_tags');
  return (raw || []).map(mapFeaturedTag);
}

/**
 * Hashtags featured on somebody else's profile.
 *
 * Public, so this works without following them, and is a better summary of
 * what an account posts about than its bio usually is.
 */
export async function getAccountFeaturedTags(accountId: string): Promise<FeaturedTag[]> {
  const raw = await get<any[]>(
    `/api/v1/accounts/${encodeURIComponent(accountId)}/featured_tags`
  );
  return (raw || []).map(mapFeaturedTag);
}

/**
 * Feature a hashtag on your profile.
 *
 * The name is sent without a leading hash; the server rejects it otherwise.
 */
export async function featureTag(name: string): Promise<FeaturedTag> {
  const raw = await post<any>('/api/v1/featured_tags', {
    name: name.replace(/^#/, ''),
  });
  return mapFeaturedTag(raw);
}

/**
 * Stop featuring a hashtag. Keyed on the FeaturedTag id, not the tag name.
 */
export async function unfeatureTag(featuredTagId: string): Promise<void> {
  await del(`/api/v1/featured_tags/${encodeURIComponent(featuredTagId)}`);
}

/**
 * Tags you have used recently, as candidates to feature.
 *
 * These come back as plain tags, not FeaturedTags — they have no featuring id
 * yet, which is exactly what {@link featureTag} creates.
 */
export async function getFeaturedTagSuggestions(): Promise<MastodonTag[]> {
  const raw = await get<any[]>('/api/v1/featured_tags/suggestions');
  return (raw || []).map(mapTag);
}
