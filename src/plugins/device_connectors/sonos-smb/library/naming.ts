/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { extname } from "node:path";

const ILLEGAL_CHARS_REGEX = /[/\\:*?"<>|\x00-\x1f]/g;

/**
 * Replaces SMB/Windows illegal characters and control characters with `_`.
 */
export function sanitize(name: string): string {
  return name.replace(ILLEGAL_CHARS_REGEX, "_");
}

export interface SongNameInput {
  name?: string;
  trackNumber?: number;
  diskNumber?: number;
  filePath: string;
}

/**
 * Builds the display file name for a song: `<NN> - <sanitized title><ext>`,
 * or `<D>-<NN> - ...` when the disk number is greater than 1, so that a
 * client sorting entries by name orders them by disk then track (the server
 * already returns them in that order). The `<NN> - ` prefix is omitted when
 * `trackNumber` is missing; the extension comes from the real file path.
 */
export function songFileName(song: SongNameInput): string {
  const ext = extname(song.filePath);
  const title = sanitize(song.name ?? "");

  let prefix = "";
  if (song.trackNumber !== undefined) {
    const track = String(song.trackNumber).padStart(2, "0");
    prefix =
      song.diskNumber !== undefined && song.diskNumber > 1
        ? `${song.diskNumber}-${track} - `
        : `${track} - `;
  }

  return `${prefix}${title}${ext}`;
}

/**
 * Deduplicates a list of file names, appending ` (n)` (1-based, before the
 * extension) to the 2nd and subsequent occurrences of a name. Collision
 * detection is case-insensitive.
 */
export function dedupe(names: string[]): string[] {
  const counts = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = counts.get(key) ?? 0;
    counts.set(key, count + 1);
    if (count === 0) {
      return name;
    }
    const ext = extname(name);
    const base = ext.length > 0 ? name.slice(0, -ext.length) : name;
    return `${base} (${count})${ext}`;
  });
}
