import { get } from '../client';
import { mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonPost } from '@/types/mastodon';

interface TimelineResponse {
  posts: MastodonPost[];
  nextMaxId: string | null;
}

/**
 * Get home timeline (posts from accounts the user follows)
 */
export async function getHomeTimeline(maxId?: string): Promise<TimelineResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v1/timelines/home', {
    max_id: maxId,
    limit: '20',
  });

  const posts = raw.map((p) => mapPost(p, instanceUrl));
  const nextMaxId = posts.length > 0 ? posts[posts.length - 1].id : null;

  return { posts, nextMaxId };
}

/**
 * Get public timeline (federated or local)
 */
export async function getPublicTimeline(
  maxId?: string,
  local?: boolean
): Promise<TimelineResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>('/api/v1/timelines/public', {
    max_id: maxId,
    local: local ? 'true' : undefined,
    limit: '20',
  });

  const posts = raw.map((p) => mapPost(p, instanceUrl));
  const nextMaxId = posts.length > 0 ? posts[posts.length - 1].id : null;

  return { posts, nextMaxId };
}

/**
 * Get posts with a specific hashtag
 */
export async function getHashtagTimeline(
  hashtag: string,
  maxId?: string
): Promise<TimelineResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>(`/api/v1/timelines/tag/${encodeURIComponent(hashtag)}`, {
    max_id: maxId,
    limit: '20',
  });

  const posts = raw.map((p) => mapPost(p, instanceUrl));
  const nextMaxId = posts.length > 0 ? posts[posts.length - 1].id : null;

  return { posts, nextMaxId };
}

/**
 * Get posts from a specific list
 */
export async function getListTimeline(
  listId: string,
  maxId?: string
): Promise<TimelineResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>(`/api/v1/timelines/list/${encodeURIComponent(listId)}`, {
    max_id: maxId,
    limit: '20',
  });

  const posts = raw.map((p) => mapPost(p, instanceUrl));
  const nextMaxId = posts.length > 0 ? posts[posts.length - 1].id : null;

  return { posts, nextMaxId };
}
