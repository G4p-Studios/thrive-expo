import type {
  MastodonAccount,
  MastodonPost,
  MastodonMediaAttachment,
  MastodonNotification,
  MastodonList,
  SearchResponse,
} from '@/types/mastodon';

/**
 * Map Mastodon API account response (snake_case) to app type (camelCase)
 */
export function mapAccount(raw: any, instanceUrl: string = ''): MastodonAccount {
  return {
    id: raw.id,
    username: raw.username,
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
    url: raw.url,
    type: raw.type,
    description: raw.description,
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
    poll: raw.poll,
    application: raw.application,
    mentions: raw.mentions,
    tags: raw.tags,
    emojis: raw.emojis,
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
