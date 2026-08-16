import { authenticatedFetch, getPaginated, type PageCursor } from '../client';

export interface DomainBlocksResponse {
  domains: string[];
  /** Pass back to load the next page; null once the list is exhausted. */
  next: PageCursor | null;
}

/**
 * Domains you have blocked.
 *
 * Unlike every other collection in this client, the response is an array of
 * bare domain strings rather than entities — there is no id to paginate on, so
 * the `Link` header is the only cursor available.
 */
export async function getDomainBlocks(cursor?: PageCursor | null): Promise<DomainBlocksResponse> {
  const { items, next } = await getPaginated<string[]>('/api/v1/domain_blocks', {
    limit: '100',
    ...(cursor ?? {}),
  });

  return { domains: items || [], next };
}

/**
 * Block an entire domain.
 *
 * This is heavier than blocking an account: it hides every public post and
 * notification from the domain and **removes all of your followers there**.
 * Existing follows you have are left alone.
 *
 * The domain goes in the query string rather than the body — the endpoint reads
 * form parameters, and this avoids sending a body on DELETE for the unblock.
 */
export async function blockDomain(domain: string): Promise<void> {
  await authenticatedFetch('/api/v1/domain_blocks', {
    method: 'POST',
    params: { domain },
  });
}

/**
 * Remove a domain block.
 *
 * Followers removed by the original block are not restored.
 */
export async function unblockDomain(domain: string): Promise<void> {
  await authenticatedFetch('/api/v1/domain_blocks', {
    method: 'DELETE',
    params: { domain },
  });
}
