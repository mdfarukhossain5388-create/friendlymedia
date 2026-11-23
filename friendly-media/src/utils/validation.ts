/**
 * Validation & sanitization aligned strictly with firebase-blueprint.json constraints.
 */

export const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;
export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30);
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export function isSafeUrl(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:video/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isSafeUrl(trimmed)) return trimmed;
  return '';
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]{2,32}/g) || [];
  const unique = Array.from(new Set(matches.map((tag) => tag.slice(1).toLowerCase())));
  return unique.slice(0, 15);
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z0-9_.]{3,30}/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase()))).slice(0, 10);
}

export function clampText(text: string, maxLength: number): string {
  return text.trim().slice(0, maxLength);
}

/**
 * Validates Adsterra ad placement script / URL input.
 * Rejects non-Adsterra arbitrary inline payloads like <iframe src="javascript:..."> or Google AdSense snippets.
 */
export function validateAdsterraInput(scriptCode: string, directLinkUrl?: string): {
  valid: boolean;
  reason?: string;
} {
  const combined = `${scriptCode}\n${directLinkUrl || ''}`.toLowerCase();
  if (combined.includes('googlesyndication') || combined.includes('adsbygoogle') || combined.includes('doubleclick')) {
    return {
      valid: false,
      reason: 'FRIENDLY MEDIA supports Adsterra monetization exclusively. Google AdSense / Ad Manager tags are not permitted.',
    };
  }
  if (combined.includes('javascript:')) {
    return { valid: false, reason: 'Unsafe javascript: URI detected.' };
  }
  if (directLinkUrl && directLinkUrl.trim() && !isSafeUrl(directLinkUrl)) {
    return { valid: false, reason: 'Direct Link URL must use https:// or http://.' };
  }
  if (scriptCode.trim().length > 5000) {
    return { valid: false, reason: 'Adsterra script snippet must be 5,000 characters or less.' };
  }
  return { valid: true };
}
