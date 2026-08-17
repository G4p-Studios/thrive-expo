import { get, post, put, del, getPaginated, type PageCursor } from '../client';
import { mapMediaAttachment } from '../mappers';
import type { MastodonMediaAttachment } from '@/types/mastodon';
import type { PostVisibility } from './statuses';

/**
 * A post the server is holding until its publication time.
 *
 * Note that the id space is separate from statuses: a scheduled status has no
 * status id until it publishes, so it cannot be favourited, replied to or
 * linked to before then.
 */
export interface ScheduledStatus {
  id: string;
  scheduledAt: string;
  text: string;
  spoilerText: string;
  sensitive: boolean;
  visibility: PostVisibility | null;
  inReplyToId: string | null;
  mediaAttachments: MastodonMediaAttachment[];
}

function mapScheduledStatus(raw: any): ScheduledStatus {
  const params = raw?.params ?? {};
  return {
    id: String(raw.id),
    scheduledAt: raw.scheduled_at ?? '',
    text: params.text ?? '',
    spoilerText: params.spoiler_text ?? '',
    sensitive: !!params.sensitive,
    visibility: params.visibility ?? null,
    inReplyToId: params.in_reply_to_id ? String(params.in_reply_to_id) : null,
    mediaAttachments: (raw.media_attachments ?? []).map(mapMediaAttachment),
  };
}

/**
 * The server refuses anything closer than five minutes out.
 *
 * Checking before sending turns a rejected request into a message the composer
 * can show while the text is still on screen.
 */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/**
 * Whether a chosen time is far enough ahead to be accepted.
 *
 * Takes the current time as an argument rather than reading the clock, so it
 * can be called during render without making the result depend on when the
 * render happened.
 */
export function isScheduleTimeValid(scheduledAt: Date, now: number): boolean {
  return scheduledAt.getTime() - now >= MIN_SCHEDULE_LEAD_MS;
}

export interface SchedulePostOptions {
  inReplyToId?: string;
  mediaIds?: string[];
  visibility?: PostVisibility;
  sensitive?: boolean;
  spoilerText?: string;
  idempotencyKey?: string;
}

/**
 * Schedule a post for later.
 *
 * This is the same endpoint as {@link createPost}, but adding `scheduled_at`
 * changes what comes back: a ScheduledStatus rather than a Status. Treating
 * the response as a post would give callers an id that does not resolve, so it
 * is a separate function rather than an option on `createPost`.
 */
export async function schedulePost(
  status: string,
  scheduledAt: Date,
  options: SchedulePostOptions = {}
): Promise<ScheduledStatus> {
  const body: Record<string, unknown> = {
    status,
    scheduled_at: scheduledAt.toISOString(),
  };

  if (options.inReplyToId) body.in_reply_to_id = options.inReplyToId;
  if (options.mediaIds?.length) body.media_ids = options.mediaIds;
  if (options.visibility) body.visibility = options.visibility;
  if (options.sensitive) body.sensitive = options.sensitive;
  if (options.spoilerText) body.spoiler_text = options.spoilerText;

  const headers = options.idempotencyKey
    ? { 'Idempotency-Key': options.idempotencyKey }
    : undefined;

  const raw = await post<any>('/api/v1/statuses', body, headers);
  return mapScheduledStatus(raw);
}

export async function getScheduledStatuses(
  cursor?: PageCursor | null
): Promise<{ statuses: ScheduledStatus[]; next: PageCursor | null }> {
  const { items, next } = await getPaginated<any[]>('/api/v1/scheduled_statuses', {
    limit: '20',
    ...(cursor ?? {}),
  });
  return { statuses: (items || []).map(mapScheduledStatus), next };
}

export async function getScheduledStatus(id: string): Promise<ScheduledStatus> {
  const raw = await get<any>(`/api/v1/scheduled_statuses/${encodeURIComponent(id)}`);
  return mapScheduledStatus(raw);
}

/**
 * Move a scheduled post to a different time.
 *
 * Only the time can change — the text and attachments are fixed once
 * scheduled. Rewording means cancelling and scheduling again.
 */
export async function rescheduleStatus(
  id: string,
  scheduledAt: Date
): Promise<ScheduledStatus> {
  const raw = await put<any>(`/api/v1/scheduled_statuses/${encodeURIComponent(id)}`, {
    scheduled_at: scheduledAt.toISOString(),
  });
  return mapScheduledStatus(raw);
}

/**
 * Cancel a scheduled post before it publishes.
 */
export async function cancelScheduledStatus(id: string): Promise<void> {
  await del(`/api/v1/scheduled_statuses/${encodeURIComponent(id)}`);
}
