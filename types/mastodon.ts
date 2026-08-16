
export interface MastodonAccount {
  id: string;
  /** Short, local-only name (`alex`). Not unique across the fediverse. */
  username: string;
  /**
   * Webfinger handle: `alex` for accounts on the current instance,
   * `alex@example.social` for everyone else. This is the form Mastodon
   * resolves when it parses `@mentions` out of a status.
   */
  acct: string;
  displayName: string;
  avatar: string;
  instanceUrl: string;
  note?: string;
  header?: string;
  followersCount?: number;
  followingCount?: number;
  statusesCount?: number;
  url?: string;
  locked?: boolean;
  discoverable?: boolean;
  bot?: boolean;
  following?: boolean;
}

export interface MastodonMediaAttachment {
  id: string;
  url: string;
  type: string;
  description?: string;
  previewUrl?: string;
  blurhash?: string;
}

export interface MastodonMention {
  id: string;
  username: string;
  /** Full webfinger handle — see {@link MastodonAccount.acct}. */
  acct: string;
  url: string;
}

export interface MastodonPost {
  id: string;
  uri?: string;
  url?: string;
  account: MastodonAccount;
  content: string;
  createdAt: string;
  mediaAttachments: MastodonMediaAttachment[];
  reblogsCount: number;
  favouritesCount: number;
  repliesCount: number;
  reblogged: boolean;
  favourited: boolean;
  bookmarked?: boolean;
  reblog?: MastodonPost;
  inReplyToId?: string;
  inReplyToAccountId?: string;
  sensitive?: boolean;
  spoilerText?: string;
  visibility?: string;
  language?: string;
  card?: any;
  poll?: MastodonPoll;
  application?: any;
  mentions?: MastodonMention[];
  tags?: any[];
  emojis?: any[];
}

export interface MastodonList {
  id: string;
  title: string;
  repliesPolicy: 'followed' | 'list' | 'none';
}

export interface MastodonNotification {
  id: string;
  type: string;
  createdAt: string;
  account: MastodonAccount;
  status?: MastodonPost;
}

export interface MastodonRelationship {
  id: string;
  following: boolean;
  followedBy: boolean;
  blocking: boolean;
  blockedBy: boolean;
  muting: boolean;
  mutingNotifications: boolean;
  requested: boolean;
  domainBlocking: boolean;
  endorsed: boolean;
  note: string;
}

export interface MastodonPoll {
  id: string;
  expiresAt: string | null;
  expired: boolean;
  multiple: boolean;
  votesCount: number;
  votersCount: number | null;
  voted: boolean;
  ownVotes: number[];
  options: Array<{
    title: string;
    votesCount: number | null;
  }>;
}

/**
 * The subset of `GET /api/v2/instance` → `configuration` that the client acts on.
 * Every instance can raise or lower these, so nothing here should be hardcoded.
 */
export interface MastodonInstanceConfig {
  maxCharacters: number;
  maxMediaAttachments: number;
  /** Every URL counts as this many characters regardless of its real length. */
  charactersReservedPerUrl: number;
  maxPollOptions: number;
  maxPollOptionChars: number;
  /** MIME types the instance accepts for uploads; empty when the server omits it. */
  supportedMimeTypes: string[];
  imageSizeLimit: number;
  videoSizeLimit: number;
}

export interface MastodonEmoji {
  shortcode: string;
  url: string;
  staticUrl: string;
  visibleInPicker: boolean;
}

export interface SearchResponse {
  accounts: MastodonAccount[];
  statuses: MastodonPost[];
  hashtags: Array<{
    name: string;
    url: string;
    history: Array<{
      day: string;
      uses: string;
      accounts: string;
    }>;
  }>;
}
