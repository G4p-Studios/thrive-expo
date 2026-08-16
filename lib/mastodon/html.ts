/**
 * Flatten the HTML Mastodon returns for bios and post bodies into plain text.
 *
 * The app renders text rather than parsing markup, so block-level tags become
 * line breaks instead of vanishing — otherwise two paragraphs run together into
 * one unreadable line.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Ampersand last, so an encoded "&amp;lt;" does not become a tag.
    .replace(/&amp;/g, '&')
    .trim();
}
