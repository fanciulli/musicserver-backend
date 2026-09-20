/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import * as fs from "node:fs";

/**
 * Returns the size in bytes of the file at `filePath`.
 */
export async function size(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath);
  return stats.size;
}

/**
 * Reads up to `length` bytes from `filePath` starting at `offset`. The
 * returned buffer may be shorter than `length` when reading past EOF.
 */
export async function read(
  filePath: string,
  offset: number,
  length: number,
): Promise<Buffer> {
  const fd = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
}
