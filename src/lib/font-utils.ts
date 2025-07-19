// src/lib/font-utils.ts
export function detectCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export function getFontClass(text: string): string {
  return detectCyrillic(text) ? 'font-cyrillic' : 'font-body';
}
