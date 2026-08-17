import { useEffect, useState } from 'react';
import { getInstanceConfig, supportsQuotePosts } from './endpoints/instance';

/**
 * Whether this server can attach a quote to a post.
 *
 * Starts false so the quote control never flashes in and out on servers that
 * cannot do it — appearing and then vanishing is worse than arriving a moment
 * late. The instance config is cached after the first call, so on every screen
 * but the first this resolves immediately.
 */
export function useQuoteSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const config = await getInstanceConfig();
        if (!cancelled) setSupported(supportsQuotePosts(config));
      } catch {
        // An unreachable instance endpoint says nothing about quote support;
        // leaving the control hidden is the safer of the two wrong answers.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return supported;
}
