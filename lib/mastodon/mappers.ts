import type {
  MastodonAccount,
  MastodonPost,
  MastodonMediaAttachment,
  MastodonMention,
  MastodonPoll,
  MastodonFilter,
  MastodonFilterKeyword,
  MastodonFilterResult,
  MastodonConversation,
  MastodonNotification,
  MastodonList,
  MastodonRelationship,
  SearchResponse,
} from '@/types/mastodon';

/**
 * Map Mastodon API account response (snake_case) to app type (camelCase)
 */
export function mapAccount(raw: any, instanceUrl: string = ''): MastodonAccount {
  return {
    id: raw.id,
    username: raw.username,
    // Local accounts come back with `acct === username`; remote ones carry the
    // domain. Fall back to `username` only if the server omitted `acct`.
    acct: raw.acct || raw.username,
    displayName: raw.display_name || raw.username,
    avatar: raw.avatar,
    instanceUrl,
    note: raw.note,
    header: raw.header,
    followersCount: raw.followers_count,
    followingCount: raw.following_count,
    statusesCount: raw.statuses_count,
    url: raw.url,
    locked: raw.locked,
    discoverable: raw.discoverable,
    bot: raw.bot,
    following: raw.following,
  };
}

/**
 * Map Mastodon API media attachment
 */
export function mapMediaAttachment(raw: any): MastodonMediaAttachment {
  return {
    id: raw.id,
    url: raw.url,
    type: raw.type,
    description: raw.description,
    previewUrl: raw.preview_url,
    blurhash: raw.blurhash,
  };
}

/**
 * Map a mention entry attached to a status
 */
export function mapMention(raw: any): MastodonMention {
  return {
    id: raw.id,
    username: raw.username,
    acct: raw.acct || raw.username,
    url: raw.url,
  };
}

/**
 * Map a poll attached to a status
 */
export function mapPoll(raw: any): MastodonPoll {
  return {
    id: raw.id,
    expiresAt: raw.expires_at ?? null,
    expired: !!raw.expired,
    multiple: !!raw.multiple,
    votesCount: raw.votes_count ?? 0,
    // Null when the instance hides voter counts on remote polls.
    votersCount: raw.voters_count ?? null,
    voted: !!raw.voted,
    ownVotes: raw.own_votes || [],
    options: (raw.options || []).map((option: any) => ({
      title: option.title,
      votesCount: option.votes_count ?? null,
    })),
  };
}

/**
 * Map a keyword belonging to a filter
 */
export function mapFilterKeyword(raw: any): MastodonFilterKeyword {
  return {
    id: String(raw.id),
    keyword: raw.keyword ?? '',
    wholeWord: !!raw.whole_word,
  };
}

/**
 * Map a filter group
 */
export function mapFilter(raw: any): MastodonFilter {
  return {
    id: String(raw.id),
    title: raw.title ?? '',
    context: Array.isArray(raw.context) ? raw.context : [],
    expiresAt: raw.expires_at ?? null,
    // Older servers only know `warn`, which is also the documented default.
    filterAction: raw.filter_action ?? 'warn',
    keywords: (raw.keywords || []).map(mapFilterKeyword),
  };
}

/**
 * Map the filter match attached to a status
 */
export function mapFilterResult(raw: any): MastodonFilterResult {
  return {
    filter: mapFilter(raw.filter || {}),
    keywordMatches: raw.keyword_matches || [],
    statusMatches: raw.status_matches || [],
  };
}

/**
 * Map Mastodon API status/post response to app type
 */
export function mapPost(raw: any, instanceUrl: string = ''): MastodonPost {
  return {
    id: raw.id,
    uri: raw.uri,
    url: raw.url,
    account: mapAccount(raw.account, instanceUrl),
    content: raw.content,
    createdAt: raw.created_at,
    mediaAttachments: (raw.media_attachments || []).map(mapMediaAttachment),
    reblogsCount: raw.reblogs_count || 0,
    favouritesCount: raw.favourites_count || 0,
    repliesCount: raw.replies_count || 0,
    reblogged: raw.reblogged || false,
    favourited: raw.favourited || false,
    bookmarked: raw.bookmarked || false,
    reblog: raw.reblog ? mapPost(raw.reblog, instanceUrl) : undefined,
    inReplyToId: raw.in_reply_to_id,
    inReplyToAccountId: raw.in_reply_to_account_id,
    sensitive: raw.sensitive,
    spoilerText: raw.spoiler_text,
    visibility: raw.visibility,
    language: raw.language,
    card: raw.card,
    poll: raw.poll ? mapPoll(raw.poll) : undefined,
    application: raw.application,
    filtered: (raw.filtered || []).map(mapFilterResult),
    mentions: (raw.mentions || []).map(mapMention),
    tags: raw.tags,
    emojis: raw.emojis,
  };
}

/**
 * Map a direct-message conversation
 */
export function mapConversation(raw: any, instanceUrl: string = ''): MastodonConversation {
  return {
    id: String(raw.id),
    unread: !!raw.unread,
    accounts: (raw.accounts || []).map((a: any) => mapAccount(a, instanceUrl)),
    // Absent on a conversation whose only post has since been deleted.
    lastStatus: raw.last_status ? mapPost(raw.last_status, instanceUrl) : undefined,
  };
}

/**
 * Map Mastodon API notification response
 */
export function mapNotification(raw: any, instanceUrl: string = ''): MastodonNotification {
  return {
    id: raw.id,
    type: raw.type,
    createdAt: raw.created_at,
    account: mapAccount(raw.account, instanceUrl),
    status: raw.status ? mapPost(raw.status, instanceUrl) : undefined,
  };
}

/**
 * Map Mastodon API list response
 */
export function mapList(raw: any): MastodonList {
  return {
    id: raw.id,
    title: raw.title,
    repliesPolicy: raw.replies_policy || 'list',
  };
}

/**
 * Map Mastodon API search response
 */
export function mapSearchResponse(raw: any, instanceUrl: string = ''): SearchResponse {
  return {
    accounts: (raw.accounts || []).map((a: any) => mapAccount(a, instanceUrl)),
    statuses: (raw.statuses || []).map((s: any) => mapPost(s, instanceUrl)),
    hashtags: raw.hashtags || [],
  };
}

/**
 * Map Mastodon API relationship response
 */
export function mapRelationship(raw: any): MastodonRelationship {
  return {
    id: raw.id,
    following: raw.following || false,
    followedBy: raw.followed_by || false,
    blocking: raw.blocking || false,
    blockedBy: raw.blocked_by || false,
    muting: raw.muting || false,
    mutingNotifications: raw.muting_notifications || false,
    requested: raw.requested || false,
    domainBlocking: raw.domain_blocking || false,
    endorsed: raw.endorsed || false,
    note: raw.note || '',
  };
}
