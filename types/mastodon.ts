
export interface MastodonAccount {
  id?: string;
  username: string;
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
  url: string;
  type: string;
  description?: string;
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
  poll?: any;
  application?: any;
  mentions?: any[];
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
