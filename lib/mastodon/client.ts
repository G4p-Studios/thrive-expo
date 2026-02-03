import { getAccessToken, getInstanceUrl } from './storage';

export class MastodonAPIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string
  ) {
    super(`Mastodon API error: ${status} ${statusText}`);
    this.name = 'MastodonAPIError';
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
 * Make a request to a specific Mastodon instance
 * Used for OAuth and public endpoints
 */
export async function mastodonFetch<T>(
  instanceUrl: string,
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
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
    'Content-Type': 'application/json',
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
    throw new MastodonAPIError(response.status, response.statusText, text);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  console.log(`[Mastodon] ${endpoint} OK`);
  return data;
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
  body?: Record<string, unknown>
): Promise<T> {
  return authenticatedFetch<T>(endpoint, { method: 'POST', body });
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
