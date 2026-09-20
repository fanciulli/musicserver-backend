/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import path from "node:path";

export function buildArtPath(rootFolder: string, uuid: string): string {
  const firstLevel = uuid.slice(0, 2);
  const secondLevel = uuid.slice(2, 4);
  return path.join(rootFolder, firstLevel, secondLevel, uuid);
}
