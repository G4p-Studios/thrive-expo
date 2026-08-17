import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { MastodonStream, type StreamHandlers, type StreamName } from './streaming';

interface Options extends StreamHandlers {
  /** Set false to stay disconnected, e.g. while signed out. */
  enabled?: boolean;
}

/**
 * Keep a stream connected while the app is on screen.
 *
 * Deliberately disconnects on backgrounding: iOS suspends sockets anyway, and
 * holding one open drains battery for events nobody is looking at. The
 * background notification poll covers that period instead.
 *
 * @returns whether the stream is currently connected.
 */
export function useTimelineStream(stream: StreamName, options: Options): boolean {
  const { enabled = true, ...handlers } = options;
  const [connected, setConnected] = useState(false);

  // Handlers are re-created every render by most callers, so they live in a ref
  // and the socket is not torn down each time. Updated in an effect rather than
  // during render, which must stay free of side effects.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    const client = new MastodonStream(stream, {
      onUpdate: post => handlersRef.current.onUpdate?.(post),
      onDelete: id => handlersRef.current.onDelete?.(id),
      onNotification: n => handlersRef.current.onNotification?.(n),
      onStatusUpdate: post => handlersRef.current.onStatusUpdate?.(post),
      onConversation: c => handlersRef.current.onConversation?.(c),
      onFiltersChanged: () => handlersRef.current.onFiltersChanged?.(),
      onConnectionChange: isConnected => {
        setConnected(isConnected);
        handlersRef.current.onConnectionChange?.(isConnected);
      },
    });

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') client.connect();
      else client.close();
    };

    if (AppState.currentState === 'active') client.connect();
    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      client.close();
    };
  }, [stream, enabled]);

  return connected;
}
