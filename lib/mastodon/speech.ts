/**
 * Join the pieces of an accessibility label into one spoken string.
 *
 * Screen readers pause on a full stop, which is what separates the parts of a
 * post so they do not run together. But a plain `join('. ')` doubles the stop
 * on any part that already ends in punctuation — post bodies nearly always do
 * — and VoiceOver reads "world.." with a stumble rather than a clean break.
 *
 * So a separator is only added where one is missing. Empty parts are dropped
 * rather than leaving a stop with nothing between it and the next.
 */
export function joinSpokenParts(parts: (string | null | undefined)[]): string {
  return parts
    .map(part => part?.trim())
    .filter((part): part is string => !!part)
    .reduce((spoken, part) => {
      if (!spoken) return part;
      // Terminal punctuation already tells the reader to pause.
      return /[.!?…:,]$/.test(spoken) ? `${spoken} ${part}` : `${spoken}. ${part}`;
    }, '');
}
