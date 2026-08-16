/**
 * Character counting that matches how the server actually measures a status.
 *
 * Mastodon does not count the raw string. Its `StatusLengthValidator` rewrites
 * the text before measuring:
 *
 *  - every URL collapses to a fixed width (23 by default), however long it is;
 *  - a remote mention counts only its username — `@alex@example.social` costs
 *    the same as `@alex`;
 *  - the content warning is measured together with the body against one limit.
 *
 * Counting naively makes the composer reject posts the server would accept,
 * which is very visible on replies, where the prefill is all remote handles.
 */

/** Approximates Mastodon's URL pattern closely enough for counting. */
const URL_RE = /https?:\/\/\S+/gi;

/**
 * Matches `@user` and `@user@domain`, capturing the preceding character so we
 * can require a boundary without a lookbehind (Hermes support for those is not
 * something to rely on). Mirrors Mastodon's rule that a mention may not follow
 * `=`, `/` or a word character — which is what keeps email addresses out.
 */
const MENTION_RE = /(^|[^=/\w])@(\w[\w.-]*)(@[\w.-]+)?/g;

/** Counts codepoints rather than UTF-16 units, so emoji count as one. */
function codepointLength(text: string): number {
  return [...text].length;
}

/**
 * Rewrite `text` the way the server does before measuring it.
 * Exported for testing and for showing users what will be counted.
 */
export function countableText(text: string, charactersReservedPerUrl = 23): string {
  return text
    .replace(URL_RE, 'x'.repeat(charactersReservedPerUrl))
    .replace(MENTION_RE, (_match, before: string, username: string) => `${before}@${username}`);
}

/**
 * The length the server will attribute to this status.
 *
 * @param text      The post body.
 * @param options   `spoilerText` is added to the total; `charactersReservedPerUrl`
 *                  comes from the instance configuration.
 */
export function countStatusCharacters(
  text: string,
  options: { spoilerText?: string; charactersReservedPerUrl?: number } = {}
): number {
  const { spoilerText = '', charactersReservedPerUrl = 23 } = options;

  return (
    codepointLength(countableText(text, charactersReservedPerUrl)) + codepointLength(spoilerText)
  );
}
