import { createHash, randomBytes } from "node:crypto";
import { ApiKeyCheckStatus } from "fastify-auth-by-api-key";
import type { Db } from "mongodb";

const COLLECTION_NAME = "api_keys";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `ms_${randomBytes(32).toString("hex")}`;
  const prefix = key.substring(0, 10);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export async function validateApiKey(
  db: Db,
  key: string,
): Promise<ApiKeyCheckStatus> {
  try {
    const hash = hashApiKey(key);
    const found = await db
      .collection<{ keyHash: string; expiresAt: Date | null }>(COLLECTION_NAME)
      .findOne({ keyHash: hash });

    if (!found) return ApiKeyCheckStatus.Invalid;
    if (found.expiresAt !== null && new Date() > new Date(found.expiresAt)) {
      return ApiKeyCheckStatus.Invalid;
    }
    return ApiKeyCheckStatus.Valid;
  } catch {
    return ApiKeyCheckStatus.Error;
  }
}
