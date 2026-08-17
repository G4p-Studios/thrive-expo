import { getPaginated, type PageCursor } from '../client';
import { mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonPost } from '@/types/mastodon';

interface TimelineResponse {
  posts: MastodonPost[];
  /**
   * Cursor for the next (older) page, taken from the `Link` header.
   * Null once there is nothing older.
   */
  next: PageCursor | null;
  /**
   * The last post's id, kept for callers that still page by id.
   * @deprecated Prefer `next`, which is what the API guidelines direct clients
   * to use — some collections paginate on ids that never appear in the body.
   */
  nextMaxId: string | null;
}

/**
 * Fetch a timeline, following the `Link` header for pagination.
 *
 * The official guidance is to use the `next`/`prev` relations rather than the
 * last item's id. It also means `min_id` paging forward is available, which is
 * what a "load newer" control would need.
 */
async function getTimeline(
  endpoint: string,
  cursor?: PageCursor | null,
  extraParams: Record<string, string | undefined> = {}
): Promise<TimelineResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>(endpoint, {
    limit: '20',
    ...extraParams,
    ...(cursor ?? {}),
  });

  const posts = (items || []).map(p => mapPost(p, instanceUrl));

  return {
    posts,
    next,
    nextMaxId: posts.length > 0 ? posts[posts.length - 1].id : null,
  };
}

/**
 * Get home timeline (posts from accounts the user follows)
 */
export async function getHomeTimeline(cursor?: PageCursor | string | null): Promise<TimelineResponse> {
  return getTimeline('/api/v1/timelines/home', toCursor(cursor));
}

/**
 * Get public timeline (federated or local)
 */
export async function getPublicTimeline(
  cursor?: PageCursor | string | null,
  local?: boolean
): Promise<TimelineResponse> {
  return getTimeline('/api/v1/timelines/public', toCursor(cursor), {
    local: local ? 'true' : undefined,
  });
}

/**
 * Get posts with a specific hashtag
 */
export async function getHashtagTimeline(
  hashtag: string,
  cursor?: PageCursor | string | null
): Promise<TimelineResponse> {
  return getTimeline(`/api/v1/timelines/tag/${encodeURIComponent(hashtag)}`, toCursor(cursor));
}

/**
 * Get posts from a specific list
 */
export async function getListTimeline(
  listId: string,
  cursor?: PageCursor | string | null
): Promise<TimelineResponse> {
  return getTimeline(`/api/v1/timelines/list/${encodeURIComponent(listId)}`, toCursor(cursor));
}

/**
 * Accept either a `Link` cursor or a bare max_id.
 *
 * Screens were written against the old id-based signature, so both keep
 * working while they move across.
 */
function toCursor(cursor?: PageCursor | string | null): PageCursor | null {
  if (!cursor) return null;
  return typeof cursor === 'string' ? { max_id: cursor } : cursor;
}
