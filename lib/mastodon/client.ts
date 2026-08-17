import { getAccessToken, getInstanceUrl } from './storage';

export class MastodonAPIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
    /** Seconds until the rate limit resets, when the server said so. */
    public retryAfterSeconds?: number
  ) {
    super(MastodonAPIError.describe(status, statusText, body, retryAfterSeconds));
    this.name = 'MastodonAPIError';
  }

  /**
   * A message worth putting in front of someone.
   *
   * Mastodon returns a JSON body with an `error` field explaining what went
   * wrong; surfacing "Mastodon API error: 422" instead of "Validation failed"
   * helps nobody.
   */
  private static describe(
    status: number,
    statusText: string,
    body: string,
    retryAfterSeconds?: number
  ): string {
    if (status === 429) {
      return retryAfterSeconds
        ? `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute${
            retryAfterSeconds > 60 ? 's' : ''
          }.`
        : 'Too many requests. Wait a moment and try again.';
    }

    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        return parsed.error;
      }
    } catch {
      // Not JSON; fall through.
    }

    return `Mastodon API error: ${status} ${statusText}`;
  }

  /** Whether waiting and retrying could plausibly succeed. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated. Please connect your Mastodon account.');
    this.name = 'NotAuthenticatedError';
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: Record<string, unknown>;
  params?: Record<string, string | undefined>;
}

/**
 * Make an authenticated request to the Mastodon API
 * Automatically retrieves instance URL and access token from storage
 */
export async function authenticatedFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const [instanceUrl, accessToken] = await Promise.all([
    getInstanceUrl(),
    getAccessToken(),
  ]);

  if (!instanceUrl || !accessToken) {
    throw new NotAuthenticatedError();
  }

  return mastodonFetch<T>(instanceUrl, endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
}

/**
 * Query parameters pulled out of a `Link` header, ready to send back.
 */
export type PageCursor = Record<string, string>;

export interface PaginatedResult<T> {
  items: T;
  /** Cursor for the next (older) page, or null at the end of the collection. */
  next: PageCursor | null;
  /** Cursor for the previous (newer) page. */
  prev: PageCursor | null;
}

/**
 * Parse a `Link` header into next/prev cursors.
 *
 * Some collections — blocks and mutes especially — paginate on internal ids
 * that never appear in the response body, so the last item's `id` is the wrong
 * cursor and the `Link` header is the only correct way to page through them.
 */
export function parseLinkHeader(header: string | null | undefined): {
  next: PageCursor | null;
  prev: PageCursor | null;
} {
  const result: { next: PageCursor | null; prev: PageCursor | null } = { next: null, prev: null };
  if (!header) return result;

  // Matching entries directly avoids splitting on commas that may appear inside a URL.
  const entryPattern = /<([^>]+)>\s*;\s*rel\s*=\s*"?([^",;\s]+)"?/g;

  for (const match of header.matchAll(entryPattern)) {
    const [, url, rel] = match;
    if (rel !== 'next' && rel !== 'prev') continue;

    const queryStart = url.indexOf('?');
    if (queryStart === -1) continue;

    const params: PageCursor = {};
    for (const pair of url.slice(queryStart + 1).split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
      params[key] = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1));
    }

    if (Object.keys(params).length > 0) result[rel] = params;
  }

  return result;
}

/**
 * Authenticated GET that also returns the pagination cursors from `Link`.
 */
export async function getPaginated<T>(
  endpoint: string,
  params?: Record<string, string | undefined>
): Promise<PaginatedResult<T>> {
  const [instanceUrl, accessToken] = await Promise.all([
    getInstanceUrl(),
    getAccessToken(),
  ]);

  if (!instanceUrl || !accessToken) {
    throw new NotAuthenticatedError();
  }

  const { data, headers } = await mastodonFetchRaw<T>(instanceUrl, endpoint, {
    method: 'GET',
    params,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { next, prev } = parseLinkHeader(headers.get('link'));
  return { items: data, next, prev };
}

/**
 * Make a request to a specific Mastodon instance
 * Used for OAuth and public endpoints
 */
export async function mastodonFetch<T>(
  instanceUrl: string,
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { data } = await mastodonFetchRaw<T>(instanceUrl, endpoint, options);
  return data;
}

/**
 * As `mastodonFetch`, but exposes the response headers for callers that need
 * `Link` pagination.
 */
export async function mastodonFetchRaw<T>(
  instanceUrl: string,
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ data: T; headers: Headers }> {
  const { body, params, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${instanceUrl}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, value);
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const method = fetchOptions.method || 'GET';
  console.log(`[Mastodon] ${method} ${endpoint}`);

  const headers: Record<string, string> = {
    // Only describe a body that exists. Sending this on a GET is harmless
    // against Mastodon but is a lie about the request.
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(fetchOptions.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[Mastodon] ${response.status} ${endpoint}:`, text);

    // Mastodon reports rate limits with X-RateLimit-Reset (an ISO timestamp)
    // and the standard Retry-After. Passing that through lets callers say when
    // to come back rather than just failing.
    let retryAfterSeconds: number | undefined;
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const reset = response.headers.get('x-ratelimit-reset');

      if (retryAfter && Number.isFinite(Number(retryAfter))) {
        retryAfterSeconds = Number(retryAfter);
      } else if (reset) {
        const resetAt = new Date(reset).getTime();
        if (Number.isFinite(resetAt)) {
          retryAfterSeconds = Math.max(0, Math.round((resetAt - Date.now()) / 1000));
        }
      }
    }

    throw new MastodonAPIError(response.status, response.statusText, text, retryAfterSeconds);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return { data: {} as T, headers: response.headers };
  }

  const data = await response.json();
  console.log(`[Mastodon] ${endpoint} OK`);
  return { data, headers: response.headers };
}

/**
 * Make an authenticated GET request
 */
export async function get<T>(
  endpoint: string,
  params?: Record<string, string | undefined>
): Promise<T> {
  return authenticatedFetch<T>(endpoint, { method: 'GET', params });
}

/**
 * Make an authenticated POST request
 */
export async function post<T>(
  endpoint: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<T> {
  return authenticatedFetch<T>(endpoint, { method: 'POST', body, headers });
}

/**
 * Make an authenticated DELETE request
 */
export async function del<T>(endpoint: string): Promise<T> {
  return authenticatedFetch<T>(endpoint, { method: 'DELETE' });
}

/**
 * Make an authenticated PATCH request
 */
export async function patch<T>(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  return authenticatedFetch<T>(endpoint, { method: 'PATCH', body });
}

/**
 * Make an authenticated PUT request
 */
export async function put<T>(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  return authenticatedFetch<T>(endpoint, { method: 'PUT', body });
}

/**
 * Upload FormData (multipart) to the Mastodon API
 * Does NOT set Content-Type header — fetch auto-sets the multipart boundary
 */
export async function uploadFormData<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const [instanceUrl, accessToken] = await Promise.all([
    getInstanceUrl(),
    getAccessToken(),
  ]);

  if (!instanceUrl || !accessToken) {
    throw new NotAuthenticatedError();
  }

  const url = `${instanceUrl}${endpoint}`;
  console.log(`[Mastodon] POST (multipart) ${endpoint}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[Mastodon] ${response.status} ${endpoint}:`, text);
    throw new MastodonAPIError(response.status, response.statusText, text);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  console.log(`[Mastodon] ${endpoint} OK`);
  return data;
}
