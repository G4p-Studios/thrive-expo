import { get } from '../client';
import { getInstanceConfigCache, setInstanceConfigCache } from '../storage';
import type { MastodonInstanceConfig } from '@/types/mastodon';

/**
 * Mastodon's own defaults, used until the real instance answers.
 *
 * These are only a starting point — instances routinely raise `max_characters`
 * well past 500, so anything user-facing should prefer the fetched config.
 */
export const DEFAULT_INSTANCE_CONFIG: MastodonInstanceConfig = {
  maxCharacters: 500,
  maxMediaAttachments: 4,
  charactersReservedPerUrl: 23,
  maxPollOptions: 4,
  maxPollOptionChars: 50,
  supportedMimeTypes: [],
  imageSizeLimit: 16777216,
  videoSizeLimit: 103809024,
};

function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function mapInstanceConfig(raw: any): MastodonInstanceConfig {
  const config = raw?.configuration ?? {};
  const statuses = config.statuses ?? {};
  const media = config.media_attachments ?? {};
  const polls = config.polls ?? {};
  const d = DEFAULT_INSTANCE_CONFIG;

  return {
    maxCharacters: toPositiveInt(statuses.max_characters, d.maxCharacters),
    maxMediaAttachments: toPositiveInt(statuses.max_media_attachments, d.maxMediaAttachments),
    charactersReservedPerUrl: toPositiveInt(
      statuses.characters_reserved_per_url,
      d.charactersReservedPerUrl
    ),
    maxPollOptions: toPositiveInt(polls.max_options, d.maxPollOptions),
    maxPollOptionChars: toPositiveInt(polls.max_characters_per_option, d.maxPollOptionChars),
    supportedMimeTypes: Array.isArray(media.supported_mime_types) ? media.supported_mime_types : [],
    imageSizeLimit: toPositiveInt(media.image_size_limit, d.imageSizeLimit),
    videoSizeLimit: toPositiveInt(media.video_size_limit, d.videoSizeLimit),
  };
}

/**
 * Fetch the instance configuration and cache it.
 *
 * `/api/v2/instance` supersedes the v1 endpoint, which has been deprecated
 * since Mastodon 4.0.
 */
export async function fetchInstanceConfig(): Promise<MastodonInstanceConfig> {
  const raw = await get<any>('/api/v2/instance');
  const config = mapInstanceConfig(raw);
  await setInstanceConfigCache(config);
  return config;
}

/** Whether this app session has already revalidated the cached config. */
let revalidatedThisSession = false;

/**
 * Read the instance configuration, preferring the cache so callers (the
 * composer, mainly) never wait on the network to render.
 *
 * Cached values are served immediately and refreshed in the background once per
 * session, so an admin raising `max_characters` is picked up without the
 * composer ever blocking on a request.
 *
 * Falls back to Mastodon's documented defaults if the instance is unreachable,
 * so a failed request degrades to "probably right" rather than to nothing.
 */
export async function getInstanceConfig(): Promise<MastodonInstanceConfig> {
  const cached = await getInstanceConfigCache();

  if (cached) {
    if (!revalidatedThisSession) {
      revalidatedThisSession = true;
      fetchInstanceConfig().catch((error) => {
        console.warn('[Mastodon] Could not refresh instance limits:', error);
      });
    }
    return cached;
  }

  try {
    const config = await fetchInstanceConfig();
    revalidatedThisSession = true;
    return config;
  } catch (error) {
    console.warn('[Mastodon] Falling back to default instance limits:', error);
    return DEFAULT_INSTANCE_CONFIG;
  }
}
