import { get, post, put, del } from '../client';

/**
 * Which notification types the server should push, and from whom.
 */
export interface PushAlerts {
  mention?: boolean;
  status?: boolean;
  reblog?: boolean;
  follow?: boolean;
  followRequest?: boolean;
  favourite?: boolean;
  poll?: boolean;
  update?: boolean;
}

export type PushPolicy = 'all' | 'followed' | 'follower' | 'none';

export interface WebPushSubscription {
  id: string;
  endpoint: string;
  /** The server's VAPID public key, needed to verify incoming pushes. */
  serverKey: string;
  alerts: PushAlerts;
}

export interface CreatePushSubscriptionOptions {
  /**
   * An HTTPS endpoint that speaks the Web Push protocol (RFC 8030).
   *
   * **This cannot be an Expo, APNs or FCM token.** Mastodon delivers encrypted
   * Web Push messages to this URL and never talks to Apple's or Google's
   * gateways itself, so reaching a phone needs a relay that accepts Web Push
   * and forwards to APNs/FCM. Mastodon's own apps use one for exactly this
   * reason. Until Thrive has a relay to point at, this endpoint is unused and
   * notifications come from polling instead.
   */
  endpoint: string;
  /** Base64 P-256 ECDH public key the server encrypts payloads to. */
  p256dh: string;
  /** Base64 16-byte auth secret. */
  auth: string;
  alerts?: PushAlerts;
  policy?: PushPolicy;
}

function mapSubscription(raw: any): WebPushSubscription {
  const alerts = raw?.alerts ?? {};
  return {
    id: String(raw?.id ?? ''),
    endpoint: raw?.endpoint ?? '',
    serverKey: raw?.server_key ?? '',
    alerts: {
      mention: alerts.mention,
      status: alerts.status,
      reblog: alerts.reblog,
      follow: alerts.follow,
      followRequest: alerts['follow_request'],
      favourite: alerts.favourite,
      poll: alerts.poll,
      update: alerts.update,
    },
  };
}

function alertsToBody(alerts: PushAlerts | undefined): Record<string, unknown> {
  if (!alerts) return {};
  return {
    mention: alerts.mention,
    status: alerts.status,
    reblog: alerts.reblog,
    follow: alerts.follow,
    follow_request: alerts.followRequest,
    favourite: alerts.favourite,
    poll: alerts.poll,
    update: alerts.update,
  };
}

/**
 * Register a Web Push subscription with the Mastodon server.
 *
 * Requires the `push` scope, which the OAuth flow already asks for.
 */
export async function createPushSubscription(
  options: CreatePushSubscriptionOptions
): Promise<WebPushSubscription> {
  const raw = await post<any>('/api/v1/push/subscription', {
    subscription: {
      endpoint: options.endpoint,
      keys: {
        p256dh: options.p256dh,
        auth: options.auth,
      },
    },
    data: {
      alerts: alertsToBody(options.alerts),
      ...(options.policy ? { policy: options.policy } : {}),
    },
  });

  return mapSubscription(raw);
}

/**
 * The subscription tied to the current access token, or null if there is none.
 */
export async function getPushSubscription(): Promise<WebPushSubscription | null> {
  try {
    return mapSubscription(await get<any>('/api/v1/push/subscription'));
  } catch (error: any) {
    // 404 is the documented "you have no subscription", not a failure.
    if (error?.status === 404) return null;
    throw error;
  }
}

/**
 * Change which alerts an existing subscription delivers.
 *
 * Only the data half can change this way; a different endpoint or key means
 * creating a new subscription.
 */
export async function updatePushSubscription(
  alerts: PushAlerts,
  policy?: PushPolicy
): Promise<WebPushSubscription> {
  const raw = await put<any>('/api/v1/push/subscription', {
    data: {
      alerts: alertsToBody(alerts),
      ...(policy ? { policy } : {}),
    },
  });
  return mapSubscription(raw);
}

export async function deletePushSubscription(): Promise<void> {
  await del('/api/v1/push/subscription');
}
