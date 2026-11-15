const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Normalizes a user-typed link into an absolute http(s) URL.
 *
 * - Blank values become `null`.
 * - Scheme-less input such as `x.com/project` is assumed to be `https://`.
 * - Protocol-relative input such as `//example.com` is resolved as https.
 * - Any other scheme (`ftp:`, `javascript:`, `mailto:` …) is rejected.
 * - Values that cannot be parsed as a URL are rejected.
 */
export function normalizeHttpUrl(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  let candidate: string;
  if (trimmed.startsWith("//")) {
    candidate = `https:${trimmed}`;
  } else if (SCHEME_PATTERN.test(trimmed)) {
    if (!/^https?:\/\//i.test(trimmed)) return null;
    candidate = trimmed;
  } else {
    candidate = `https://${trimmed.replace(/^\/+/, "")}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // A public project/artwork link always has a dotted host; this also keeps
    // typos like "https://foo" from being stored as if they were valid.
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
