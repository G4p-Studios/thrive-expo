import { uploadFormData, put, get } from '../client';
import { mapMediaAttachment } from '../mappers';
import type { MastodonMediaAttachment } from '@/types/mastodon';
import { Platform } from 'react-native';

/** How long to wait for the server to finish transcoding before giving up. */
const PROCESSING_TIMEOUT_MS = 60_000;
const PROCESSING_POLL_INTERVAL_MS = 1_000;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Fetch an attachment's current state.
 *
 * Returns 206 while the server is still processing, which `mastodonFetch`
 * passes through as a normal response with a null `url`.
 */
export async function getMediaAttachment(mediaId: string): Promise<MastodonMediaAttachment> {
  const raw = await get<any>(`/api/v1/media/${encodeURIComponent(mediaId)}`);
  return mapMediaAttachment(raw);
}

/**
 * Wait for an upload to finish processing.
 *
 * Video, GIF and audio uploads come back from `/api/v2/media` as `202 Accepted`
 * with a null `url` while the server transcodes them. Polling until the `url`
 * appears is what keeps previews from rendering as broken images.
 *
 * A timeout is not treated as a failure: the attachment id is already valid and
 * posting it works, so the last known state is returned and the caller carries
 * on rather than losing the upload.
 */
export async function waitForMediaProcessing(
  attachment: MastodonMediaAttachment,
  timeoutMs: number = PROCESSING_TIMEOUT_MS
): Promise<MastodonMediaAttachment> {
  if (attachment.url) return attachment;

  const deadline = Date.now() + timeoutMs;
  let latest = attachment;

  while (Date.now() < deadline) {
    await delay(PROCESSING_POLL_INTERVAL_MS);

    try {
      latest = await getMediaAttachment(attachment.id);
      if (latest.url) return latest;
    } catch (error) {
      // A transient failure while polling shouldn't discard a valid upload.
      console.warn('[Mastodon] Error polling media processing:', error);
    }
  }

  console.warn('[Mastodon] Media still processing after timeout:', attachment.id);
  return latest;
}

/**
 * Upload media to the Mastodon instance
 * Returns the media attachment with an `id` to pass to createPost
 *
 * Waits for server-side processing so callers always receive a displayable
 * attachment; pass `waitForProcessing: false` to return as soon as it uploads.
 */
export async function uploadMedia(
  uri: string,
  mimeType: string,
  description?: string,
  options: { waitForProcessing?: boolean } = {}
): Promise<MastodonMediaAttachment> {
  const formData = new FormData();

  const filename = uri.split('/').pop() || 'upload';

  // React Native needs the file object format for FormData
  formData.append('file', {
    uri: Platform.OS === 'web' ? uri : uri,
    type: mimeType,
    name: filename,
  } as any);

  if (description) {
    formData.append('description', description);
  }

  const raw = await uploadFormData<any>('/api/v2/media', formData);
  const attachment = mapMediaAttachment(raw);

  if (options.waitForProcessing === false) return attachment;
  return waitForMediaProcessing(attachment);
}

/**
 * Set or change an attachment's description (alt text).
 *
 * Only valid while the attachment is unattached — once it has been posted, the
 * description can only change via a status edit.
 */
export async function updateMediaDescription(
  mediaId: string,
  description: string
): Promise<MastodonMediaAttachment> {
  const raw = await put<any>(`/api/v1/media/${encodeURIComponent(mediaId)}`, { description });
  return mapMediaAttachment(raw);
}
