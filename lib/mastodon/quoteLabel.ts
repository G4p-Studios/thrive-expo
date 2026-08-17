import { stripHtml } from './html';
import { describeQuoteState } from './endpoints/statuses';
import type { MastodonPost, MastodonQuote } from '@/types/mastodon';

export interface QuoteLabel {
  /**
   * Spoken before the quoting author's own words: who quoted whom, then what
   * they quoted.
   */
  lead: string[];
  /**
   * Prefix for the quoting author's own text, so the two voices cannot be
   * confused. Null when there is no quoted post to distinguish it from.
   */
  addedPrefix: string | null;
}

/**
 * Build the spoken form of a quote post.
 *
 * A quote post is two posts in one, and read flat it is ambiguous — there is
 * no way to hear where the quoted words end and the quoter's begin. So it is
 * announced the way Twitter does: who quoted whom, the quoted words, then
 * "X added:" before their own. The attribution comes first because that is
 * what decides how the rest should be heard.
 *
 * Returns null when there is nothing to say, so callers can skip the section.
 */
export function buildQuoteLabel(
  quoterName: string,
  quote: MastodonQuote | undefined
): QuoteLabel | null {
  if (!quote) return null;

  const quoted = quote.state === 'accepted' ? quote.quotedStatus : undefined;

  // Every state other than `accepted` means there is no post to read, and each
  // needs its own wording — silence would read as a broken post.
  if (!quoted) {
    const reason = describeQuoteState(quote.state);
    return reason ? { lead: [reason], addedPrefix: null } : null;
  }

  const quotedName = quoted.account.displayName?.trim() || quoted.account.username;
  const lead = [`${quoterName} quoted ${quotedName}, @${quoted.account.acct}`];

  const spoiler = quoted.spoilerText?.trim() || '';
  if (spoiler) {
    // The quoted author's content warning still applies inside somebody else's
    // post; quoting must not be a way around it.
    lead.push(`Content warning: ${spoiler}`);
    lead.push('Quoted post hidden behind a content warning');
  } else {
    const body = stripHtml(quoted.content ?? '').trim();
    if (body) lead.push(body);
    lead.push(...describeQuotedMedia(quoted));
  }

  return { lead, addedPrefix: `${quoterName} added:` };
}

/**
 * Attachments on the quoted post, read by their alt text where the author
 * wrote any.
 */
function describeQuotedMedia(quoted: MastodonPost): string[] {
  const media = quoted.mediaAttachments ?? [];
  if (media.length === 0) return [];

  const plural = media.length === 1 ? 'attachment' : 'attachments';

  if (quoted.sensitive) {
    return [`Quoted post has ${media.length} hidden ${plural}`];
  }

  const descriptions = media
    .slice(0, 4)
    .map((m, i) => m.description?.trim() || `Image ${i + 1}`);

  return [`Quoted post has ${media.length} ${plural}: ${descriptions.join(', ')}`];
}
