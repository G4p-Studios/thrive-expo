import { get, post } from '../client';
import { mapPoll } from '../mappers';
import type { MastodonPoll } from '@/types/mastodon';

/**
 * Get the current state of a poll.
 */
export async function getPoll(pollId: string): Promise<MastodonPoll> {
  const raw = await get<any>(`/api/v1/polls/${encodeURIComponent(pollId)}`);
  return mapPoll(raw);
}

/**
 * Vote on a poll.
 *
 * @param choices Zero-indexed positions of the chosen options. Polls with
 *                `multiple: false` accept exactly one.
 */
export async function voteOnPoll(pollId: string, choices: number[]): Promise<MastodonPoll> {
  // The request body is JSON, so `choices` goes over as a real array rather
  // than the `choices[0]=…` form encoding the docs show.
  const raw = await post<any>(`/api/v1/polls/${encodeURIComponent(pollId)}/votes`, {
    choices,
  });
  return mapPoll(raw);
}
