import { post, del, getPaginated, type PageCursor } from '../client';
import { mapConversation } from '../mappers';
import { getInstanceUrl } from '../storage';
import type { MastodonConversation } from '@/types/mastodon';

export interface ConversationsResponse {
  conversations: MastodonConversation[];
  /** Pass back to load the next page; null once the list is exhausted. */
  next: PageCursor | null;
}

/**
 * Your direct-message threads, newest activity first.
 *
 * Conversations paginate on an internal id that is not the conversation's own
 * `id`, so the `Link` header is the correct cursor here too.
 */
export async function getConversations(
  cursor?: PageCursor | null
): Promise<ConversationsResponse> {
  const instanceUrl = await getInstanceUrl() || '';
  const { items, next } = await getPaginated<any[]>('/api/v1/conversations', {
    limit: '20',
    ...(cursor ?? {}),
  });

  return {
    conversations: (items || []).map(c => mapConversation(c, instanceUrl)),
    next,
  };
}

/**
 * Mark a conversation as read, clearing its unread flag.
 */
export async function markConversationRead(
  conversationId: string
): Promise<MastodonConversation> {
  const instanceUrl = await getInstanceUrl() || '';
  const raw = await post<any>(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/read`,
    {}
  );
  return mapConversation(raw, instanceUrl);
}

/**
 * Remove a conversation from your list.
 *
 * This only removes your copy of the thread — the posts themselves are not
 * deleted, and the other participants still have theirs.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await del(`/api/v1/conversations/${encodeURIComponent(conversationId)}`);
}
