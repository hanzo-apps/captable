/**
 * A return path is honoured only when it is a path on this site: one leading
 * slash, then anything but a second slash or a backslash, which a browser reads
 * as another host, and no whitespace, which a browser strips before reading it.
 * Anything else returns to `fallback`.
 */
export const sameSitePath = (path: string | undefined, fallback: string) =>
  path && /^\/(?![/\\])/.test(path) && !/\s/.test(path) ? path : fallback;
