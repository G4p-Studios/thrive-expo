import { get, post, del, put } from '../client';
import { mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonPost } from '@/types/mastodon';

/**
 * Get a single post by ID
 */
export async function getPost(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any>(`/api/v1/statuses/${encodeURIComponent(postId)}`);
  return mapPost(raw, instanceUrl);
}

/**
 * Get the context (ancestors and descendants) of a post
 */
export async function getPostContext(postId: string): Promise<{ ancestors: MastodonPost[]; descendants: MastodonPost[] }> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/context`);
  return {
    ancestors: (raw.ancestors || []).map((p: any) => mapPost(p, instanceUrl)),
    descendants: (raw.descendants || []).map((p: any) => mapPost(p, instanceUrl)),
  };
}

export type PostVisibility = 'public' | 'unlisted' | 'private' | 'direct';

interface CreatePostOptions {
  inReplyToId?: string;
  mediaIds?: string[];
  visibility?: PostVisibility;
  sensitive?: boolean;
  spoilerText?: string;
  /**
   * Collapses duplicate submissions server-side. Reuse the same key when
   * retrying a post that may already have gone through — without it, a retry
   * after a dropped response posts twice.
   */
  idempotencyKey?: string;
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

  const headers = options.idempotencyKey
    ? { 'Idempotency-Key': options.idempotencyKey }
    : undefined;

  const raw = await post<any>('/api/v1/statuses', body, headers);
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

/**
 * Delete a post
 */
export async function deletePost(postId: string): Promise<void> {
  await del(`/api/v1/statuses/${encodeURIComponent(postId)}`);
}

export interface MastodonStatusSource {
  id: string;
  /** The original markup the author typed, not the rendered HTML. */
  text: string;
  spoilerText: string;
}

/**
 * Get a post's editable source.
 *
 * The status entity only carries rendered HTML; loading that into an editor
 * would show the author markup they never wrote and lose their original line
 * breaks. This returns the text as they typed it.
 */
export async function getStatusSource(postId: string): Promise<MastodonStatusSource> {
  const raw = await get<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/source`);
  return {
    id: raw.id,
    text: raw.text ?? '',
    spoilerText: raw.spoiler_text ?? '',
  };
}

interface EditPostOptions {
  mediaIds?: string[];
  sensitive?: boolean;
  spoilerText?: string;
}

/**
 * Edit a post (status)
 */
export async function editPost(
  postId: string,
  status: string,
  options: EditPostOptions = {}
): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const body: Record<string, unknown> = { status };

  if (options.mediaIds?.length) {
    body.media_ids = options.mediaIds;
  }
  if (options.sensitive !== undefined) {
    body.sensitive = options.sensitive;
  }
  // Sent even when empty so clearing a content warning actually removes it.
  if (options.spoilerText !== undefined) {
    body.spoiler_text = options.spoilerText;
  }

  const raw = await put<any>(`/api/v1/statuses/${encodeURIComponent(postId)}`, body);
  return mapPost(raw, instanceUrl);
}

/**
 * Pin a post to your profile
 */
export async function pinPost(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/pin`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Unpin a post from your profile
 */
export async function unpinPost(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/unpin`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Mute a conversation (stop receiving notifications from replies)
 */
export async function muteConversation(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/mute`, {});
  return mapPost(raw, instanceUrl);
}

/**
 * Unmute a conversation
 */
export async function unmuteConversation(postId: string): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/unmute`, {});
  return mapPost(raw, instanceUrl);
}
