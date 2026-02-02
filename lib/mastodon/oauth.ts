import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { mastodonFetch } from './client';
import { mapAccount } from './mappers';
import {
  getOAuthApp,
  setOAuthApp,
  setAccessToken,
  setInstanceUrl,
  setAccountCache,
  type OAuthCredentials,
} from './storage';
import type { MastodonAccount } from '@/types/mastodon';

const APP_NAME = 'Thrive';
const APP_WEBSITE = 'https://github.com/thrive-app';
const SCOPES = 'read write follow push';

/**
 * Get the redirect URI for OAuth callbacks
 * Uses Expo Linking to generate the correct URI for each platform
 */
export function getRedirectUri(): string {
  // Use Expo Linking to generate the correct URI for the current environment
  // This handles both Expo Go (exp://) and standalone builds (Thrive://)
  return Linking.createURL('mastodon-callback');
}

/**
 * Normalize instance URL to ensure consistent format
 */
export function normalizeInstanceUrl(url: string): string {
  let normalized = url.trim().toLowerCase();

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Add https if no protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }

  return normalized;
}

interface RegisterAppResult {
  clientId: string;
  clientSecret: string;
  authUrl: string;
}

/**
 * Register an OAuth application with a Mastodon instance
 * Returns existing credentials if already registered with matching redirect URI
 */
export async function registerApp(instanceUrl: string): Promise<RegisterAppResult> {
  const normalizedUrl = normalizeInstanceUrl(instanceUrl);
  const redirectUri = getRedirectUri();

  // Check if we already have credentials for this instance
  const existing = await getOAuthApp(normalizedUrl);
  if (existing && existing.redirectUri === redirectUri) {
    console.log('[OAuth] Using cached app credentials for:', normalizedUrl);
    return {
      clientId: existing.clientId,
      clientSecret: existing.clientSecret,
      authUrl: buildAuthorizationUrl(normalizedUrl, existing.clientId),
    };
  }

  if (existing) {
    console.log('[OAuth] Redirect URI changed, re-registering app for:', normalizedUrl);
    console.log('[OAuth] Old URI:', existing.redirectUri);
    console.log('[OAuth] New URI:', redirectUri);
  } else {
    console.log('[OAuth] Registering new app with:', normalizedUrl);
  }

  // Register the app with the Mastodon instance
  const response = await mastodonFetch<{
    client_id: string;
    client_secret: string;
  }>(normalizedUrl, '/api/v1/apps', {
    method: 'POST',
    body: {
      client_name: APP_NAME,
      redirect_uris: redirectUri,
      scopes: SCOPES,
      website: APP_WEBSITE,
    },
  });

  const credentials: OAuthCredentials = {
    clientId: response.client_id,
    clientSecret: response.client_secret,
    redirectUri: redirectUri,
    createdAt: new Date().toISOString(),
  };

  // Store credentials for future use
  await setOAuthApp(normalizedUrl, credentials);

  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    authUrl: buildAuthorizationUrl(normalizedUrl, credentials.clientId),
  };
}

/**
 * Build the authorization URL for the OAuth flow
 */
function buildAuthorizationUrl(instanceUrl: string, clientId: string): string {
  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    response_type: 'code',
  });

  return `${instanceUrl}/oauth/authorize?${params.toString()}`;
}

interface ExchangeCodeResult {
  accessToken: string;
  account: MastodonAccount;
}

/**
 * Exchange an authorization code for an access token
 */
export async function exchangeCode(
  instanceUrl: string,
  code: string
): Promise<ExchangeCodeResult> {
  const normalizedUrl = normalizeInstanceUrl(instanceUrl);

  // Get stored OAuth credentials
  const credentials = await getOAuthApp(normalizedUrl);
  if (!credentials) {
    throw new Error('No OAuth credentials found for this instance. Please try connecting again.');
  }

  const redirectUri = getRedirectUri();

  console.log('[OAuth] Exchanging code for token');

  // Exchange the authorization code for an access token
  const tokenResponse = await mastodonFetch<{
    access_token: string;
    token_type: string;
    scope: string;
    created_at: number;
  }>(normalizedUrl, '/oauth/token', {
    method: 'POST',
    body: {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code,
    },
  });

  const accessToken = tokenResponse.access_token;

  // Verify the token and get account info
  console.log('[OAuth] Verifying credentials');
  const rawAccount = await mastodonFetch<any>(
    normalizedUrl,
    '/api/v1/accounts/verify_credentials',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const account = mapAccount(rawAccount, normalizedUrl);

  // Store everything
  await setAccessToken(accessToken);
  await setInstanceUrl(normalizedUrl);
  await setAccountCache(account);

  console.log('[OAuth] Authentication complete for:', account.username);

  return {
    accessToken,
    account,
  };
}
