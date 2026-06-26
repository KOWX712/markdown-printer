export const GENERIC_FONT_KEYWORDS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
])

export function fontFamilyCSS(font: string): string {
  return GENERIC_FONT_KEYWORDS.has(font.toLowerCase()) ? font : `'${font}'`
}
