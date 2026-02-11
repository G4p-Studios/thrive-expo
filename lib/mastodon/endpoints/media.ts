import { uploadFormData } from '../client';
import { mapMediaAttachment } from '../mappers';
import type { MastodonMediaAttachment } from '@/types/mastodon';
import { Platform } from 'react-native';

/**
 * Upload media to the Mastodon instance
 * Returns the media attachment with an `id` to pass to createPost
 */
export async function uploadMedia(
  uri: string,
  mimeType: string,
  description?: string
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
  return mapMediaAttachment(raw);
}
