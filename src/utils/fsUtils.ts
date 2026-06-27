/*
 * Created on Mon Feb 09 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { readdir } from "fs/promises";
import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import path from "path";

export async function listFolderNames(parentFolder: string): Promise<string[]> {
  const dirListing = await readdir(parentFolder, { withFileTypes: true });

  const directories = dirListing
    .filter((item) => {
      return item.isDirectory();
    })
    .map((dir) => {
      return dir.name;
    });

  return directories;
}

export async function listFiles(
  parentFolder: string,
  skipFileNames: string[] = [],
  skipExtensions: string[] = [],
): Promise<string[]> {
  try {
    const dirListing: Dirent<string>[] = await readdir(parentFolder, {
      withFileTypes: true,
      recursive: true,
    });

    const files = dirListing
      .filter((item: Dirent<string>) => {
        return (
          item.isDirectory() == false &&
          !skipFileNames.includes(item.name) &&
          !skipExtensions.includes(path.extname(item.name))
        );
      })
      .map((file) => {
        return path.join(file.parentPath, file.name);
      });
    return files;
  } catch (err) {
    return [];
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
