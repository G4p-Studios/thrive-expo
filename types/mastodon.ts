
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
  card?: MastodonPreviewCard;
  poll?: MastodonPoll;
  application?: any;
  /** Filters this post matched, if any. Empty or absent when nothing matched. */
  filtered?: MastodonFilterResult[];
  mentions?: MastodonMention[];
  tags?: any[];
  emojis?: MastodonEmoji[];
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

/** One day's usage of a hashtag. Counts arrive as strings. */
export interface MastodonTagHistory {
  day: string;
  uses: string;
  accounts: string;
}

export interface MastodonTag {
  name: string;
  url: string;
  /** Most recent day first; empty on servers that don't compute trends. */
  history: MastodonTagHistory[];
  /** Whether you follow this tag. Absent for unauthenticated requests. */
  following?: boolean;
  featured?: boolean;
}

/** The link preview attached to a post, and the entity behind trending links. */
export interface MastodonPreviewCard {
  url: string;
  title: string;
  description: string;
  /** `link`, `photo`, `video` or `rich`. */
  type: string;
  authorName?: string;
  providerName?: string;
  image?: string | null;
  blurhash?: string | null;
  width?: number;
  height?: number;
}

export interface MastodonSuggestion {
  /** Why it was suggested, e.g. `past_interactions` or `global`. */
  source: string;
  account: MastodonAccount;
}

/**
 * A direct-message thread.
 *
 * Mastodon has no separate messaging system — a conversation is simply a thread
 * whose posts have `direct` visibility, grouped by participants.
 */
export interface MastodonConversation {
  id: string;
  unread: boolean;
  /** Everyone in the thread except you. */
  accounts: MastodonAccount[];
  lastStatus?: MastodonPost;
}

/** Where a filter applies. A filter must name at least one. */
export type FilterContext = 'home' | 'notifications' | 'public' | 'thread' | 'account';

/**
 * What the client should do with a matching post.
 * - `warn` — hide it behind the filter's title, revealable.
 * - `hide` — do not show it at all.
 * - `blur` — show the post but keep its media covered.
 */
export type FilterAction = 'warn' | 'hide' | 'blur';

export interface MastodonFilterKeyword {
  id: string;
  keyword: string;
  /** Match only on word boundaries, so "art" does not match "cart". */
  wholeWord: boolean;
}

export interface MastodonFilter {
  id: string;
  title: string;
  context: FilterContext[];
  expiresAt: string | null;
  filterAction: FilterAction;
  keywords: MastodonFilterKeyword[];
}

/**
 * Attached to a status the server matched against one of your filters.
 * Matching happens server-side; the client only decides how to present it.
 */
export interface MastodonFilterResult {
  filter: MastodonFilter;
  keywordMatches: string[];
  statusMatches: string[];
}

/** A server rule, used when reporting something as a rule violation. */
export interface MastodonInstanceRule {
  id: string;
  text: string;
  /** Longer explanation; servers running older versions may omit it. */
  hint?: string;
}

export type ReportCategory = 'spam' | 'legal' | 'violation' | 'other';

export interface MastodonReport {
  id: string;
  category: ReportCategory;
  comment: string;
  forwarded: boolean;
  statusIds: string[];
  ruleIds: string[];
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
  /** The server's rules, offered when reporting a violation. */
  rules: MastodonInstanceRule[];
  /**
   * Base URL for the streaming WebSocket. Often the same host as the API, but
   * larger servers run it separately, so it must be discovered rather than
   * assumed.
   */
  streamingUrl: string | null;
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
  hashtags: MastodonTag[];
}
