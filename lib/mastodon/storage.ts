import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { MastodonAccount } from '@/types/mastodon';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'thrive_access_token',
  INSTANCE_URL: 'thrive_instance_url',
  OAUTH_APPS: 'thrive_oauth_apps',
  ACCOUNT_CACHE: 'thrive_account_cache',
} as const;

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  createdAt: string;
}

type OAuthAppsStorage = Record<string, OAuthCredentials>;

// Platform-agnostic storage helpers
async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`[Storage] Error getting ${key}:`, error);
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error(`[Storage] Error setting ${key}:`, error);
    throw error;
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.error(`[Storage] Error removing ${key}:`, error);
  }
}

// Access token
export async function getAccessToken(): Promise<string | null> {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function setAccessToken(token: string): Promise<void> {
  await setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  console.log('[Storage] Access token stored');
}

// Instance URL
export async function getInstanceUrl(): Promise<string | null> {
  return getItem(STORAGE_KEYS.INSTANCE_URL);
}

export async function setInstanceUrl(url: string): Promise<void> {
  await setItem(STORAGE_KEYS.INSTANCE_URL, url);
  console.log('[Storage] Instance URL stored:', url);
}

// OAuth apps (per-instance credentials)
export async function getOAuthApp(instanceUrl: string): Promise<OAuthCredentials | null> {
  const appsJson = await getItem(STORAGE_KEYS.OAUTH_APPS);
  if (!appsJson) return null;

  try {
    const apps: OAuthAppsStorage = JSON.parse(appsJson);
    return apps[instanceUrl] || null;
  } catch {
    return null;
  }
}

export async function setOAuthApp(instanceUrl: string, credentials: OAuthCredentials): Promise<void> {
  const appsJson = await getItem(STORAGE_KEYS.OAUTH_APPS);
  let apps: OAuthAppsStorage = {};

  if (appsJson) {
    try {
      apps = JSON.parse(appsJson);
    } catch {
      // Start fresh if corrupted
    }
  }

  apps[instanceUrl] = credentials;
  await setItem(STORAGE_KEYS.OAUTH_APPS, JSON.stringify(apps));
  console.log('[Storage] OAuth app stored for:', instanceUrl);
}

// Account cache
export async function getAccountCache(): Promise<MastodonAccount | null> {
  const cacheJson = await getItem(STORAGE_KEYS.ACCOUNT_CACHE);
  if (!cacheJson) return null;

  try {
    return JSON.parse(cacheJson);
  } catch {
    return null;
  }
}

export async function setAccountCache(account: MastodonAccount): Promise<void> {
  await setItem(STORAGE_KEYS.ACCOUNT_CACHE, JSON.stringify(account));
  console.log('[Storage] Account cache stored');
}

// Clear all auth data
export async function clearAuth(): Promise<void> {
  await removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  await removeItem(STORAGE_KEYS.INSTANCE_URL);
  await removeItem(STORAGE_KEYS.ACCOUNT_CACHE);
  // Note: We keep OAUTH_APPS so user doesn't need to re-register on reconnect
  console.log('[Storage] Auth data cleared');
}

// Clear OAuth apps cache (useful when redirect URI changes)
export async function clearOAuthApps(): Promise<void> {
  await removeItem(STORAGE_KEYS.OAUTH_APPS);
  console.log('[Storage] OAuth apps cache cleared');
}

// Check if authenticated
export async function isAuthenticated(): Promise<boolean> {
  const [token, instance] = await Promise.all([
    getAccessToken(),
    getInstanceUrl(),
  ]);
  return !!(token && instance);
}
