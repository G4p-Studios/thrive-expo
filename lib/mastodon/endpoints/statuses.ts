import { get, post, del, put, getPaginated, type PageCursor } from '../client';
import { mapAccount, mapPost } from '../mappers';
import { getInstanceUrl } from '../storage';
import type {
  MastodonAccount,
  MastodonPost,
  QuoteApprovalPolicy,
  QuoteState,
} from '@/types/mastodon';

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
  /**
   * Quote another post. Mastodon 4.4+; older servers ignore it, so the post
   * still goes out — as a plain post, without the quote.
   */
  quotedStatusId?: string;
  /** Who may quote this post. Defaults to the server's setting. */
  quoteApprovalPolicy?: QuoteApprovalPolicy;
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
  if (options.quotedStatusId) {
    body.quoted_status_id = options.quotedStatusId;
  }
  if (options.quoteApprovalPolicy) {
    body.quote_approval_policy = options.quoteApprovalPolicy;
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

export interface MastodonTranslation {
  content: string;
  /** The language the server detected the original to be in. */
  detectedSourceLanguage: string;
  /** Which translation service produced it, e.g. "DeepL". */
  provider: string;
}

/**
 * Translate a post into the reader's language.
 *
 * Only available on instances that have configured a translation service; the
 * rest return 404, which callers should treat as "not offered here" rather than
 * as a failure.
 */
export async function translatePost(
  postId: string,
  targetLanguage?: string
): Promise<MastodonTranslation> {
  const body = targetLanguage ? { lang: targetLanguage } : {};
  const raw = await post<any>(`/api/v1/statuses/${encodeURIComponent(postId)}/translate`, body);

  return {
    content: raw.content ?? '',
    detectedSourceLanguage: raw.detected_source_language ?? '',
    provider: raw.provider ?? '',
  };
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

/**
 * What to tell a reader when a quoted post is not being shown.
 *
 * Returns null for `accepted`, where the post itself is the answer. Every
 * other state renders as text in place of the quote — a silent gap would read
 * as a broken post, and to a screen reader as nothing at all.
 */
export function describeQuoteState(state: QuoteState): string | null {
  switch (state) {
    case 'accepted':
      return null;
    case 'pending':
      return 'Waiting for the author to approve this quote';
    case 'rejected':
      return 'The author declined this quote';
    case 'revoked':
      return 'The author withdrew this quote';
    case 'deleted':
      return 'The quoted post was deleted';
    case 'unauthorized':
      return 'You cannot see the quoted post';
    case 'blocked_account':
      return 'Quoted post hidden because you blocked the author';
    case 'blocked_domain':
      return 'Quoted post hidden because you blocked its server';
    case 'muted_account':
      return 'Quoted post hidden because you muted the author';
  }
}

interface EditPostOptions {
  mediaIds?: string[];
  sensitive?: boolean;
  spoilerText?: string;
  /** Changing this does not invalidate quotes already accepted. */
  quoteApprovalPolicy?: QuoteApprovalPolicy;
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
  if (options.quoteApprovalPolicy) {
    body.quote_approval_policy = options.quoteApprovalPolicy;
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

interface AccountListResponse {
  accounts: MastodonAccount[];
  next: PageCursor | null;
}

/**
 * Who favourited a post.
 */
export async function getFavouritedBy(
  postId: string,
  cursor?: PageCursor | null
): Promise<AccountListResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>(
    `/api/v1/statuses/${encodeURIComponent(postId)}/favourited_by`,
    { limit: '40', ...(cursor ?? {}) }
  );
  return { accounts: (items || []).map(a => mapAccount(a, instanceUrl)), next };
}

/**
 * Who boosted a post.
 */
export async function getRebloggedBy(
  postId: string,
  cursor?: PageCursor | null
): Promise<AccountListResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>(
    `/api/v1/statuses/${encodeURIComponent(postId)}/reblogged_by`,
    { limit: '40', ...(cursor ?? {}) }
  );
  return { accounts: (items || []).map(a => mapAccount(a, instanceUrl)), next };
}

/**
 * Posts that quote this one.
 *
 * Only accepted quotes appear — a pending or revoked quote is not shown to
 * anybody but its own author.
 */
export async function getQuotes(
  postId: string,
  cursor?: PageCursor | null
): Promise<{ posts: MastodonPost[]; next: PageCursor | null }> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>(
    `/api/v1/statuses/${encodeURIComponent(postId)}/quotes`,
    { limit: '20', ...(cursor ?? {}) }
  );
  return { posts: (items || []).map(p => mapPost(p, instanceUrl)), next };
}

/**
 * Withdraw permission for somebody's quote of your post.
 *
 * The quoting post stays up but is detached: it no longer shows your post
 * inside it. This is the remedy when a quote was auto-accepted by policy and
 * turns out to be unwelcome, short of blocking the author.
 */
export async function revokeQuote(
  postId: string,
  quotingStatusId: string
): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(
    `/api/v1/statuses/${encodeURIComponent(postId)}/quotes/${encodeURIComponent(quotingStatusId)}/revoke`,
    {}
  );
  return mapPost(raw, instanceUrl);
}

/**
 * Change who may quote a post after it has gone out.
 *
 * Tightening the policy does not detach quotes that were already accepted —
 * use {@link revokeQuote} for those.
 */
export async function setQuoteApprovalPolicy(
  postId: string,
  policy: QuoteApprovalPolicy
): Promise<MastodonPost> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await put<any>(
    `/api/v1/statuses/${encodeURIComponent(postId)}/interaction_policy`,
    { quote_approval_policy: policy }
  );
  return mapPost(raw, instanceUrl);
}

export interface StatusEdit {
  content: string;
  spoilerText: string;
  sensitive: boolean;
  createdAt: string;
  account: MastodonAccount;
}

/**
 * Every version of a post that has been edited.
 *
 * The first entry is the original, so a post showing an edited marker can be
 * compared against what it used to say.
 */
export async function getStatusHistory(postId: string): Promise<StatusEdit[]> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await get<any[]>(`/api/v1/statuses/${encodeURIComponent(postId)}/history`);

  return (raw || []).map(edit => ({
    content: edit.content ?? '',
    spoilerText: edit.spoiler_text ?? '',
    sensitive: !!edit.sensitive,
    createdAt: edit.created_at ?? '',
    account: mapAccount(edit.account, instanceUrl),
  }));
}
