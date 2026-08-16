import { post } from '../client';
import type { MastodonReport, ReportCategory } from '@/types/mastodon';

/** Comments longer than this are rejected by the server. */
export const REPORT_COMMENT_MAX_LENGTH = 1000;

export interface CreateReportOptions {
  /** The account being reported. Required. */
  accountId: string;
  /** Posts attached for context. */
  statusIds?: string[];
  /** Why it is being reported; trimmed to the server's 1000 character limit. */
  comment?: string;
  /**
   * Send the report on to the account's own server as well. Only meaningful for
   * remote accounts — the local moderators cannot act on another server's user.
   */
  forward?: boolean;
  category?: ReportCategory;
  /**
   * Rules the content breaks. Supplying any of these makes the server treat the
   * report as `violation` regardless of `category`.
   */
  ruleIds?: string[];
}

/**
 * Report an account, optionally with posts as evidence, to the moderators.
 *
 * Requires the `write:reports` scope, which the `write` scope requested at
 * connect time already covers.
 */
export async function createReport(options: CreateReportOptions): Promise<MastodonReport> {
  const body: Record<string, unknown> = {
    account_id: options.accountId,
  };

  if (options.statusIds?.length) {
    body.status_ids = options.statusIds;
  }

  const comment = options.comment?.trim();
  if (comment) {
    body.comment = comment.slice(0, REPORT_COMMENT_MAX_LENGTH);
  }

  if (options.forward) {
    body.forward = true;
  }

  // Rule IDs imply `violation` server-side, so only send them for that category.
  if (options.category === 'violation' && options.ruleIds?.length) {
    body.category = 'violation';
    body.rule_ids = options.ruleIds;
  } else if (options.category) {
    body.category = options.category;
  }

  const raw = await post<any>('/api/v1/reports', body);

  return {
    id: raw.id,
    category: raw.category ?? 'other',
    comment: raw.comment ?? '',
    forwarded: !!raw.forwarded,
    statusIds: raw.status_ids || [],
    ruleIds: raw.rule_ids || [],
  };
}
