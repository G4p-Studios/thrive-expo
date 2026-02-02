import { post } from '../client';
import { mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonPost } from '@/types/mastodon';

interface CreatePostOptions {
  inReplyToId?: string;
  mediaIds?: string[];
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoilerText?: string;
}

/**
 * Create a new post (status)
 */
export async function createPost(
  status: string,
  options: CreatePostOptions = {}
): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';

  const body: Record<string, unknown> = {
    status,
  };

  if (options.inReplyToId) {
    body.in_reply_to_id = options.inReplyToId;
  }
  if (options.mediaIds?.length) {
    body.media_ids = options.mediaIds;
  }
  if (options.visibility) {
    body.visibility = options.visibility;
  }
  if (options.sensitive) {
    body.sensitive = options.sensitive;
  }
  if (options.spoilerText) {
    body.spoiler_text = options.spoilerText;
  }

  const raw = await post<any>('/api/v1/statuses', body);
  return mapPost(raw, instanceUrl);
}

/**
 * Favourite (like) a post
 */
export async function favourite(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/favourite`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Unfavourite (unlike) a post
 */
export async function unfavourite(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/unfavourite`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Reblog (boost) a post
 */
export async function reblog(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/reblog`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Unreblog (unboost) a post
 */
export async function unreblog(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/unreblog`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Bookmark a post
 */
export async function bookmark(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/bookmark`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Unbookmark a post
 */
export async function unbookmark(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/unbookmark`, {});
  return mapPost(raw, instanceUrl);
}
