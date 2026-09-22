/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function buildArtPath(rootFolder: string, uuid: string): string {
  const firstLevel = uuid.slice(0, 2);
  const secondLevel = uuid.slice(2, 4);
  return path.join(rootFolder, firstLevel, secondLevel, uuid);
}

export async function writeArt(
  rootFolder: string,
  uuid: string,
  art: Uint8Array,
): Promise<void> {
  const artPath = buildArtPath(rootFolder, uuid);
  await mkdir(path.dirname(artPath), { recursive: true });
  await writeFile(artPath, art);
}
