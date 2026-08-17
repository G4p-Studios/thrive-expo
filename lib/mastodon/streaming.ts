import { getAccessToken, getInstanceUrl } from './storage';
import { getInstanceConfig } from './endpoints/instance';
import { mapPost, mapNotification, mapConversation } from './mappers';
import type {
  MastodonConversation,
  MastodonNotification,
  MastodonPost,
} from '@/types/mastodon';

/** Which stream to subscribe to. `user` carries the home timeline and notifications. */
export type StreamName =
  | 'user'
  | 'user:notification'
  | 'public'
  | 'public:local'
  | 'direct';

export interface StreamHandlers {
  /** A new status arrived on this stream. */
  onUpdate?: (post: MastodonPost) => void;
  /** A status was deleted; only its id is sent. */
  onDelete?: (statusId: string) => void;
  onNotification?: (notification: MastodonNotification) => void;
  /** An existing status was edited. */
  onStatusUpdate?: (post: MastodonPost) => void;
  onConversation?: (conversation: MastodonConversation) => void;
  /** Your filters changed, so anything cached client-side may be stale. */
  onFiltersChanged?: () => void;
  /** Connection opened or closed, for showing a live indicator. */
  onConnectionChange?: (connected: boolean) => void;
}

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

/**
 * Build the streaming URL.
 *
 * The streaming service often lives on a different host from the API, so the
 * instance advertises it; falling back to the API host with the scheme swapped
 * is right for the many servers that run both together.
 */
async function resolveStreamingUrl(): Promise<string | null> {
  const config = await getInstanceConfig().catch(() => null);
  const advertised = config?.streamingUrl;
  if (advertised) return advertised.replace(/\/$/, '');

  const instanceUrl = await getInstanceUrl();
  if (!instanceUrl) return null;
  return instanceUrl.replace(/^http/, 'ws').replace(/\/$/, '');
}

/**
 * A live connection to one Mastodon stream.
 *
 * Reconnects with exponential backoff, because a mobile connection drops
 * constantly — moving between wifi and mobile data, or simply locking the
 * phone — and a timeline that silently stops updating is worse than one that
 * never claimed to be live.
 */
export class MastodonStream {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private closedByUs = false;

  constructor(
    private readonly stream: StreamName,
    private readonly handlers: StreamHandlers
  ) {}

  async connect(): Promise<void> {
    this.closedByUs = false;

    const [base, token] = await Promise.all([resolveStreamingUrl(), getAccessToken()]);
    if (!base || !token) {
      console.warn('[Streaming] No instance or token; not connecting');
      return;
    }

    // Subscribing through the URL means the connection is useful the moment it
    // opens, with no round trip.
    const url = `${base}/api/v1/streaming?stream=${encodeURIComponent(this.stream)}`;

    try {
      // The token goes in a header rather than the query string, which the docs
      // prefer since URLs end up in server logs.
      //
      // React Native's WebSocket takes a third `options` argument carrying
      // headers, which the DOM type definitions know nothing about — hence the
      // cast. On web this argument is ignored and the connection would need the
      // query-parameter form instead.
      const WebSocketWithHeaders = WebSocket as unknown as {
        new (
          url: string,
          protocols: string | string[] | undefined,
          options: { headers: Record<string, string> }
        ): WebSocket;
      };

      this.socket = new WebSocketWithHeaders(url, undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.warn('[Streaming] Could not open socket:', error);
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this.handlers.onConnectionChange?.(true);
    };

    this.socket.onmessage = event => this.handleMessage(event.data);

    this.socket.onerror = () => {
      // `onclose` always follows, which is where reconnection is handled.
    };

    this.socket.onclose = () => {
      this.handlers.onConnectionChange?.(false);
      if (!this.closedByUs) this.scheduleReconnect();
    };
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== 'string') return;

    let message: { event?: string; payload?: string };
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    // Every payload is itself a JSON *string*, not an object, so it needs a
    // second parse. `delete` is the exception: its payload is a bare id.
    const parsePayload = (): any => {
      if (typeof message.payload !== 'string') return message.payload;
      try {
        return JSON.parse(message.payload);
      } catch {
        return message.payload;
      }
    };

    try {
      switch (message.event) {
        case 'update':
          this.handlers.onUpdate?.(mapPost(parsePayload()));
          break;
        case 'delete':
          this.handlers.onDelete?.(String(message.payload ?? ''));
          break;
        case 'notification':
          this.handlers.onNotification?.(mapNotification(parsePayload()));
          break;
        case 'status.update':
          this.handlers.onStatusUpdate?.(mapPost(parsePayload()));
          break;
        case 'conversation':
          this.handlers.onConversation?.(mapConversation(parsePayload()));
          break;
        case 'filters_changed':
          this.handlers.onFiltersChanged?.();
          break;
        default:
          break;
      }
    } catch (error) {
      // A malformed event should never take the connection down.
      console.warn('[Streaming] Could not handle event:', message.event, error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = this.reconnectDelay;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);

    // Back off so a server that is down is not hammered, capped so the stream
    // still recovers within a minute once it returns.
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  /** Close and stop reconnecting. */
  close(): void {
    this.closedByUs = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.socket?.close();
    } catch {
      // Already closed.
    }
    this.socket = null;
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}
