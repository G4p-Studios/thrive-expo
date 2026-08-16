import React from 'react';
import { Text, Image, StyleSheet, StyleProp, TextStyle } from 'react-native';
import type { MastodonEmoji } from '@/types/mastodon';

/** Matches `:shortcode:` — Mastodon allows letters, digits and underscores. */
const SHORTCODE_PATTERN = /:([a-zA-Z0-9_]+):/g;

/**
 * Replace `:shortcode:` with the bare word, for spoken output.
 *
 * A screen reader saying "colon blobcat colon" is worse than "blobcat", and the
 * image itself carries no text.
 */
export function stripEmojiColons(text: string, emojis?: MastodonEmoji[]): string {
  if (!emojis?.length) return text;
  const known = new Set(emojis.map(e => e.shortcode));
  return text.replace(SHORTCODE_PATTERN, (match, code: string) =>
    known.has(code) ? code : match
  );
}

interface EmojiTextProps {
  text: string;
  emojis?: MastodonEmoji[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Font size drives the emoji size so they sit on the line properly. */
  size?: number;
}

/**
 * Render text with a server's custom emoji shown as images.
 *
 * Without this, posts display raw `:shortcode:` text. Emoji the server did not
 * send an image for are left as written rather than blanked out.
 */
export default function EmojiText({
  text,
  emojis,
  style,
  numberOfLines,
  size = 16,
}: EmojiTextProps) {
  if (!emojis?.length || !text.includes(':')) {
    return (
      <Text style={style} numberOfLines={numberOfLines} accessible={false}>
        {text}
      </Text>
    );
  }

  const byShortcode = new Map(emojis.map(e => [e.shortcode, e]));
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // `matchAll` needs the global flag, and a fresh regex each call keeps
  // lastIndex from leaking between renders.
  for (const match of text.matchAll(new RegExp(SHORTCODE_PATTERN))) {
    const emoji = byShortcode.get(match[1]);
    if (!emoji) continue;

    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    parts.push(
      <Image
        key={`emoji-${key++}`}
        source={{ uri: emoji.url }}
        style={[styles.emoji, { width: size, height: size }]}
        accessible={false}
      />
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <Text style={style} numberOfLines={numberOfLines} accessible={false}>
      {parts}
    </Text>
  );
}

const styles = StyleSheet.create({
  emoji: {
    // Nudges the image onto the text baseline rather than sitting high.
    transform: [{ translateY: 2 }],
  },
});
