import { get, post } from '../client';

export interface MastodonMarker {
  lastReadId: string;
  version: number;
  updatedAt: string;
}

export type MarkerTimeline = 'home' | 'notifications';

export type MastodonMarkers = Partial<Record<MarkerTimeline, MastodonMarker>>;

function mapMarker(raw: any): MastodonMarker | undefined {
  if (!raw?.last_read_id) return undefined;
  return {
    lastReadId: String(raw.last_read_id),
    version: raw.version ?? 0,
    updatedAt: raw.updated_at ?? '',
  };
}

/**
 * Where you had read up to, shared across every client signed into the account.
 *
 * This is what lets the unread notification count mean the same thing here as
 * it does in the web app.
 */
export async function getMarkers(
  timelines: MarkerTimeline[] = ['home', 'notifications']
): Promise<MastodonMarkers> {
  const params: Record<string, string> = {};
  timelines.forEach((timeline, index) => {
    params[`timeline[${index}]`] = timeline;
  });

  const raw = await get<any>('/api/v1/markers', params);

  return {
    home: mapMarker(raw?.home),
    notifications: mapMarker(raw?.notifications),
  };
}

/**
 * Save how far you have read.
 *
 * The server keeps whichever id is newer, so sending an older one is harmless
 * and there is no need to check before writing.
 */
export async function setMarkers(
  positions: Partial<Record<MarkerTimeline, string>>
): Promise<MastodonMarkers> {
  const body: Record<string, unknown> = {};
  for (const [timeline, lastReadId] of Object.entries(positions)) {
    if (lastReadId) body[timeline] = { last_read_id: lastReadId };
  }

  const raw = await post<any>('/api/v1/markers', body);

  return {
    home: mapMarker(raw?.home),
    notifications: mapMarker(raw?.notifications),
  };
}
