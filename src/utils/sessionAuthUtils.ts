import {
  scrypt,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, SCRYPT_KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N_str, r_str, p_str, saltHex, hashHex] = parts;
  try {
    const N = parseInt(N_str, 10);
    const r = parseInt(r_str, 10);
    const p = parseInt(p_str, 10);
    if (!Number.isInteger(N) || N < 1024 || N > 1048576) return false;
    if (!Number.isInteger(r) || r < 1 || r > 32) return false;
    if (!Number.isInteger(p) || p < 1 || p > 32) return false;
    const salt = Buffer.from(saltHex, "hex");
    const storedHash = Buffer.from(hashHex, "hex");
    const derived = (await scryptAsync(password, salt, storedHash.length, {
      N,
      r,
      p,
    })) as Buffer;
    return timingSafeEqual(derived, storedHash);
  } catch {
    return false;
  }
}

export function generateSessionToken(username: string): string {
  const usernamePart = Buffer.from(username).toString("base64url");
  const randomPart = randomBytes(32).toString("hex");
  return `${usernamePart}.${randomPart}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractUsernameFromToken(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  try {
    return Buffer.from(token.slice(0, dotIndex), "base64url").toString("utf8");
  } catch {
    return null;
  }
}
