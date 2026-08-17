import { stripHtml } from './html';
import { joinSpokenParts } from './speech';
import type { NotificationGroup } from './endpoints/groupedNotifications';
import type { MastodonAccount } from '@/types/mastodon';

/** Beyond this many names the list stops being easier to hear than a count. */
const MAX_NAMED = 3;

function nameOf(account: MastodonAccount): string {
  return account.displayName?.trim() || account.username;
}

/**
 * Name the people in a group the way somebody would say it aloud.
 *
 * `total` is the server's count for the whole group, which can be far larger
 * than the sample of accounts it sent — so the names run out before the count
 * does, and the remainder becomes "and 28 others".
 */
export function describeAccounts(accounts: MastodonAccount[], total: number): string {
  const names = accounts.map(nameOf);

  // The sample can come back empty if the response never described those
  // accounts; a count is still better than saying nothing.
  if (names.length === 0) {
    return total > 1 ? `${total} people` : 'Someone';
  }

  // The count is authoritative, not the size of the sample: a sample can
  // carry more accounts than the group has notifications, and naming more
  // people than the count claims would contradict the sentence.
  if (total <= MAX_NAMED && names.length >= total) {
    const named = names.slice(0, total);
    if (named.length === 1) return named[0];
    return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
  }

  // Past that, name what fits and count the rest. `others` is always at least
  // one here — this branch only runs when the count outruns what can be named.
  const named = names.slice(0, MAX_NAMED - 1);
  const others = total - named.length;

  return `${named.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

/**
 * The one-line summary of a notification group.
 *
 * This is the whole point of grouping: thirty favourites become one sentence
 * instead of thirty rows, which matters most with a screen reader, where every
 * duplicate has to be spoken past.
 */
export function describeNotificationGroup(group: NotificationGroup): string {
  const who = describeAccounts(group.accounts, group.notificationsCount);

  switch (group.type) {
    case 'favourite':
      return `${who} liked your post`;
    case 'reblog':
      return `${who} boosted your post`;
    case 'follow':
      return `${who} followed you`;
    case 'follow_request':
      return `${who} requested to follow you`;
    case 'mention':
      return `${who} mentioned you`;
    case 'status':
      return `${who} posted`;
    case 'update':
      return `${who} edited a post you boosted`;
    case 'poll':
      // Nobody "did" this one — the poll ending is the event.
      return 'A poll you voted in has ended';
    case 'admin.sign_up':
      return `${who} signed up`;
    case 'admin.report':
      return `${who} filed a report`;
    case 'severed_relationships':
      return 'Some of your relationships were severed by a moderator action';
    case 'moderation_warning':
      return 'A moderator has taken action on your account';
    default:
      return `${who} interacted with you`;
  }
}

/** Whether the post attached to this notification is the reader's own. */
function ownsStatus(type: string): boolean {
  return type === 'favourite' || type === 'reblog' || type === 'poll';
}

/**
 * What a screen reader should say for one row.
 *
 * The summary comes first, then when it happened, then a preview of the post
 * being reacted to — which is what tells somebody whether a row is worth
 * opening without having to open it.
 */
export function buildNotificationGroupLabel(
  group: NotificationGroup,
  timeAgo: string
): string {
  const parts: string[] = [describeNotificationGroup(group), timeAgo];

  if (group.status) {
    const spoiler = group.status.spoilerText?.trim();
    if (spoiler) {
      // A content warning is no less binding because the post reached you
      // through a notification.
      parts.push(`Content warning: ${spoiler}`);
    } else {
      const preview = stripHtml(group.status.content ?? '').trim();
      // Whose post it is depends on the type: a favourite is on something you
      // wrote, a mention is something they wrote. Saying "your post" for a
      // mention would attribute their words to the listener.
      if (preview) parts.push(ownsStatus(group.type) ? `Your post: ${preview}` : preview);
    }
  }

  return joinSpokenParts(parts);
}
