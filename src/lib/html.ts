const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Converts CMS article HTML into plain paragraphs for native rendering.
 * Scripts/styles are dropped entirely; no HTML is ever executed.
 */
export function htmlToParagraphs(html: string): string[] {
  const withoutCode = html
    .replace(/<(script|style|iframe|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const withBreaks = withoutCode
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|h[1-6]|ul|ol|blockquote|section|article|tr)\s*>/gi, '\n\n');
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, ''));
  return text
    .split(/\n{2,}/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);
}
