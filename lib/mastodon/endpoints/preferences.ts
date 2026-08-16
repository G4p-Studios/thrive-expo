import { get, post } from '../client';
import { stripHtml } from '../html';
import type { PostVisibility } from './statuses';

/**
 * The server-side posting and reading defaults set in the user's web
 * preferences. A client that ignores these will, for instance, cheerfully post
 * publicly for someone whose account defaults to followers-only.
 */
export interface MastodonPreferences {
  defaultVisibility: PostVisibility;
  defaultSensitive: boolean;
  defaultLanguage: string | null;
  /** `default`, `hide_all` or `show_all`. */
  expandMedia: string;
  expandSpoilers: boolean;
}

const VALID_VISIBILITIES: PostVisibility[] = ['public', 'unlisted', 'private', 'direct'];

export async function getPreferences(): Promise<MastodonPreferences> {
  const raw = await get<Record<string, any>>('/api/v1/preferences');

  const visibility = raw?.['posting:default:visibility'];

  return {
    defaultVisibility: VALID_VISIBILITIES.includes(visibility) ? visibility : 'public',
    defaultSensitive: !!raw?.['posting:default:sensitive'],
    defaultLanguage: raw?.['posting:default:language'] ?? null,
    expandMedia: raw?.['reading:expand:media'] ?? 'default',
    expandSpoilers: !!raw?.['reading:expand:spoilers'],
  };
}

export interface MastodonAnnouncement {
  id: string;
  /** Plain text; the API returns HTML. */
  content: string;
  publishedAt: string | null;
  read: boolean;
}

/**
 * Announcements the server admins have posted.
 */
export async function getAnnouncements(): Promise<MastodonAnnouncement[]> {
  const raw = await get<any[]>('/api/v1/announcements');
  return (raw || []).map(a => ({
    id: String(a.id),
    content: stripHtml(a.content ?? ''),
    publishedAt: a.published_at ?? null,
    read: !!a.read,
  }));
}

/**
 * Mark an announcement as read. There is no way to un-dismiss one.
 */
export async function dismissAnnouncement(announcementId: string): Promise<void> {
  await post(`/api/v1/announcements/${encodeURIComponent(announcementId)}/dismiss`, {});
}
