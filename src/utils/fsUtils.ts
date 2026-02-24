/*
 * Created on Mon Feb 09 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { readdir } from "fs/promises";
import path from "path";

export async function listFiles(parentFolder: string): Promise<string[]> {
  const dirListing = await readdir(parentFolder, {
    withFileTypes: true,
    recursive: true,
  });

  const files = dirListing
    .filter((item) => {
      return item.isDirectory() == false;
    })
    .map((file) => {
      return path.join(file.parentPath, file.name);
    });
  return files;
}
