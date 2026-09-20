/*
 * Created on Fri Sep 19 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { md4 } from "./md4.js";

/**
 * NTLMv2 (MS-NLMP) authentication: verifies the AUTHENTICATE (type 3)
 * message a client sends after receiving our CHALLENGE, against a
 * configured username and NT hash. Only NTLMv2 is supported (NTLMv1 relies
 * on DES, which — like MD4 — has no OpenSSL 3 default-provider support, and
 * is cryptographically weaker).
 */

const NTLMSSP_SIGNATURE = Buffer.from("NTLMSSP\0", "latin1");
const NTLMSSP_NEGOTIATE_UNICODE = 0x00000001;

export interface SonosSmbCredentials {
  username: string;
  /** Hex-encoded MD4(UTF-16LE(password)) — NTLM's "NT hash". */
  passwordNtHashHex: string;
}

/** Computes NTLM's NT hash: MD4 of the UTF-16LE-encoded password. */
export function ntHash(password: string): Buffer {
  return md4(Buffer.from(password, "utf16le"));
}

/** Computes the NT hash and hex-encodes it, for storage. */
export function ntHashHex(password: string): string {
  return ntHash(password).toString("hex");
}

interface NtlmAuthenticateFields {
  username: string;
  domain: string;
  ntChallengeResponse: Buffer;
}

/** Reads an NTLM variable-length field (Len(2) + MaxLen(2) + BufferOffset(4)) relative to `msg`. */
function readVariableField(msg: Buffer, fieldsOffset: number): Buffer {
  if (fieldsOffset + 8 > msg.length) return Buffer.alloc(0);
  const len = msg.readUInt16LE(fieldsOffset);
  const offset = msg.readUInt32LE(fieldsOffset + 4);
  if (len === 0 || offset < 0 || offset + len > msg.length) return Buffer.alloc(0);
  return msg.subarray(offset, offset + len);
}

/**
 * Parses an NTLMSSP AUTHENTICATE (type 3) message, extracting the fields
 * needed for NTLMv2 verification. Returns null if `token` isn't a
 * well-formed type-3 message.
 */
export function parseNtlmAuthenticate(token: Buffer): NtlmAuthenticateFields | null {
  const sigIndex = token.indexOf(NTLMSSP_SIGNATURE);
  if (sigIndex < 0) return null;
  const msg = token.subarray(sigIndex);
  if (msg.length < 64 || msg.readUInt32LE(8) !== 3) return null;

  const negotiateFlags = msg.readUInt32LE(60);
  const unicode = (negotiateFlags & NTLMSSP_NEGOTIATE_UNICODE) !== 0;
  const encoding: BufferEncoding = unicode ? "utf16le" : "latin1";

  const ntChallengeResponse = readVariableField(msg, 20);
  const domain = readVariableField(msg, 28).toString(encoding);
  const username = readVariableField(msg, 36).toString(encoding);

  return { username, domain, ntChallengeResponse };
}

interface Ntlmv2ProofResult {
  valid: boolean;
  /** Client's NTProofStr, taken as-is from the wire (undefined if too short to contain one). */
  clientProof?: Buffer;
  /** The same proof, recomputed server-side from the stored NT hash. */
  serverProof?: Buffer;
}

/**
 * Verifies an NTLMv2 NTChallengeResponse: the first 16 bytes are the
 * client's NTProofStr, followed by the "temp" blob (timestamp, client
 * challenge and the target-info AV-pairs, as sent by the client). The
 * server recomputes the same HMAC-MD5 proof from the stored NT hash, the
 * challenge it issued, and the client's own temp blob, and compares.
 */
function verifyNtlmv2Response(
  storedNtHash: Buffer,
  username: string,
  domain: string,
  serverChallenge: Buffer,
  ntChallengeResponse: Buffer,
): Ntlmv2ProofResult {
  if (ntChallengeResponse.length < 16) return { valid: false };

  const clientProof = ntChallengeResponse.subarray(0, 16);
  const temp = ntChallengeResponse.subarray(16);

  const identity = Buffer.from(username.toUpperCase() + domain, "utf16le");
  const ntlmv2Hash = createHmac("md5", storedNtHash).update(identity).digest();
  const serverProof = createHmac("md5", ntlmv2Hash)
    .update(Buffer.concat([serverChallenge, temp]))
    .digest();

  return { valid: timingSafeEqual(serverProof, clientProof), clientProof, serverProof };
}

export type NtlmAuthFailureReason =
  | "malformed-token"
  | "username-mismatch"
  | "response-too-short" // too short to carry an NTLMv2 proof — likely an NTLMv1-only client
  | "proof-mismatch"; // wrong password (or tampered/replayed response)

export interface NtlmAuthResult {
  authenticated: boolean;
  /** Username as sent by the client, when the token could be parsed at all. */
  receivedUsername?: string;
  /** Set only when authenticated is false. */
  failureReason?: NtlmAuthFailureReason;
}

/**
 * Verifies an NTLMSSP AUTHENTICATE token against the configured
 * credentials: the client-supplied username must match (case-insensitive),
 * and the NTLMv2 response must be valid for the stored NT hash and the
 * server challenge issued earlier in this session. Purely a verifier — it's
 * the caller's job to log the result through the plugin's logging facility.
 */
export function verifyNtlmAuthenticate(
  token: Buffer,
  serverChallenge: Buffer | undefined,
  credentials: SonosSmbCredentials,
): NtlmAuthResult {
  if (!serverChallenge) return { authenticated: false, failureReason: "malformed-token" };

  const fields = parseNtlmAuthenticate(token);
  if (!fields) return { authenticated: false, failureReason: "malformed-token" };

  const usernameMatches =
    !!credentials.username &&
    fields.username.toLowerCase() === credentials.username.toLowerCase();

  const storedNtHash = credentials.passwordNtHashHex
    ? Buffer.from(credentials.passwordNtHashHex, "hex")
    : Buffer.alloc(16);
  const { valid: proofMatches } = verifyNtlmv2Response(
    storedNtHash,
    fields.username,
    fields.domain,
    serverChallenge,
    fields.ntChallengeResponse,
  );

  if (usernameMatches && proofMatches) {
    return { authenticated: true, receivedUsername: fields.username };
  }

  const failureReason: NtlmAuthFailureReason = !usernameMatches
    ? "username-mismatch"
    : fields.ntChallengeResponse.length < 16
      ? "response-too-short"
      : "proof-mismatch";

  return { authenticated: false, receivedUsername: fields.username, failureReason };
}
