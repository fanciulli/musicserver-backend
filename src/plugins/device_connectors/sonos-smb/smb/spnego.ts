/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

/**
 * Minimal SPNEGO (RFC 4178) / NTLMSSP support: just enough DER/ASN.1 to
 * advertise NTLMSSP as the only mechanism and to exchange a fixed
 * NTLMSSP CHALLENGE, for anonymous/guest sessions. This is not a general
 * purpose GSS-API/ASN.1 implementation.
 */

const NTLMSSP_OID = "1.3.6.1.4.1.311.2.2.10";
const NTLMSSP_SIGNATURE = Buffer.from("NTLMSSP\0", "latin1");
const SERVER_TARGET_NAME = "MUSICSERVER";

// NTLMSSP NegotiateFlags used in the CHALLENGE message:
//   NTLMSSP_NEGOTIATE_UNICODE (0x00000001)
//   NTLMSSP_NEGOTIATE_NTLM (0x00000200)
//   NTLMSSP_NEGOTIATE_TARGET_TYPE_SERVER (0x00020000)
//   NTLMSSP_NEGOTIATE_TARGET_INFO (0x00800000)
//   NTLMSSP_NEGOTIATE_VERSION (0x02000000)
//   NTLMSSP_TARGET_TYPE_DOMAIN flags omitted; combined below.
const NTLM_CHALLENGE_NEGOTIATE_FLAGS = 0x00808201;

/** ASN.1/DER tag bytes used by the encoders below. */
const enum DerTag {
  OID = 0x06,
  SEQUENCE = 0x30,
  OCTET_STRING = 0x04,
  ENUMERATED = 0x0a,
  CONTEXT_0 = 0xa0,
  CONTEXT_1 = 0xa1,
  CONTEXT_2 = 0xa2,
  CONTEXT_3 = 0xa3,
  APPLICATION_0 = 0x60,
}

/** Encodes a DER length, using the short form (<=127) or the long form (1-2 length-of-length bytes). */
function derLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  if (length <= 0xff) {
    return Buffer.from([0x81, length]);
  }
  return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
}

/** Wraps `content` in a DER TLV with the given tag byte. */
function derTlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

/** Encodes an OID string (e.g. "1.3.6.1.4.1.311.2.2.10") as a DER OID value (without tag/length). */
function derOidValue(oid: string): Buffer {
  const parts = oid.split(".").map((p) => parseInt(p, 10));
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    if (part === 0) {
      bytes.push(0);
      continue;
    }
    const chunks: number[] = [];
    let value = part;
    while (value > 0) {
      chunks.unshift(value & 0x7f);
      value >>= 7;
    }
    for (let i = 0; i < chunks.length - 1; i++) {
      chunks[i] |= 0x80;
    }
    bytes.push(...chunks);
  }
  return Buffer.from(bytes);
}

function derOid(oid: string): Buffer {
  return derTlv(DerTag.OID, derOidValue(oid));
}

/**
 * Builds a SPNEGO NegTokenInit (RFC 4178 §4.2.1) advertising NTLMSSP as
 * the (only) supported mechanism:
 *
 *   NegotiationToken ::= CHOICE { negTokenInit [0] NegTokenInit }
 *   NegTokenInit ::= SEQUENCE { mechTypes [0] SEQUENCE OF MechType }
 *
 * Wrapped in the GSS-API InitialContextToken application tag with the
 * SPNEGO OID (1.3.6.1.5.5.2).
 */
export function buildNegTokenInit(): Buffer {
  const mechTypeList = derTlv(DerTag.SEQUENCE, derOid(NTLMSSP_OID));
  const mechTypes = derTlv(DerTag.CONTEXT_0, mechTypeList);
  const negTokenInit = derTlv(DerTag.SEQUENCE, mechTypes);
  const negotiationToken = derTlv(DerTag.CONTEXT_0, negTokenInit);

  const spnegoOid = derOid("1.3.6.1.5.5.2");
  const innerContextToken = Buffer.concat([spnegoOid, negotiationToken]);

  return derTlv(DerTag.APPLICATION_0, innerContextToken);
}

/**
 * Builds an NTLMSSP CHALLENGE (type 2) message:
 *
 *   Signature (8)          "NTLMSSP\0"
 *   MessageType (4)        2
 *   TargetNameFields (8)   len/maxlen/offset into TargetName (UTF-16LE)
 *   NegotiateFlags (4)
 *   ServerChallenge (8)    caller-supplied, must be persisted for the
 *                          follow-up AUTHENTICATE's NTLMv2 verification
 *   Reserved (8)           0
 *   TargetInfoFields (8)   len/maxlen/offset into TargetInfo (empty AV_EOL)
 *   Version (8)            0 (VERSION field unused/omitted, kept 0)
 *   TargetName (var)       UTF-16LE "MUSICSERVER"
 *   TargetInfo (var)       single AV_EOL (0x0000, 0x0000)
 */
export function buildNtlmChallenge(serverChallenge: Buffer): Buffer {
  const targetName = Buffer.from(SERVER_TARGET_NAME, "utf16le");
  const targetInfo = Buffer.alloc(4); // AV_EOL: AvId=0, AvLen=0

  const HEADER_LEN = 48;
  const targetNameOffset = HEADER_LEN;
  const targetInfoOffset = targetNameOffset + targetName.length;

  const msg = Buffer.alloc(targetInfoOffset + targetInfo.length);
  NTLMSSP_SIGNATURE.copy(msg, 0);
  msg.writeUInt32LE(2, 8); // MessageType = CHALLENGE

  msg.writeUInt16LE(targetName.length, 12); // TargetNameLen
  msg.writeUInt16LE(targetName.length, 14); // TargetNameMaxLen
  msg.writeUInt32LE(targetNameOffset, 16); // TargetNameBufferOffset

  msg.writeUInt32LE(NTLM_CHALLENGE_NEGOTIATE_FLAGS, 20); // NegotiateFlags

  serverChallenge.copy(msg, 24); // ServerChallenge
  msg.fill(0, 32, 40); // Reserved

  msg.writeUInt16LE(targetInfo.length, 40); // TargetInfoLen
  msg.writeUInt16LE(targetInfo.length, 42); // TargetInfoMaxLen
  msg.writeUInt32LE(targetInfoOffset, 44); // TargetInfoBufferOffset

  targetName.copy(msg, targetNameOffset);
  targetInfo.copy(msg, targetInfoOffset);

  return msg;
}

/**
 * Wraps an NTLMSSP CHALLENGE in a SPNEGO NegTokenResp (RFC 4178 §4.2.2):
 *
 *   NegTokenResp ::= SEQUENCE {
 *     negState       [0] ENUMERATED { accept-completed(0), accept-incomplete(1), ... },
 *     supportedMech  [1] MechType OPTIONAL,
 *     responseToken  [2] OCTET STRING OPTIONAL,
 *     mechListMIC    [3] OCTET STRING OPTIONAL }
 */
export function buildNegTokenResp(responseToken: Buffer, negState: number): Buffer {
  const negStateField = derTlv(DerTag.CONTEXT_0, derTlv(DerTag.ENUMERATED, Buffer.from([negState])));
  const supportedMechField = derTlv(DerTag.CONTEXT_1, derOid(NTLMSSP_OID));
  const responseTokenField = derTlv(DerTag.CONTEXT_2, derTlv(DerTag.OCTET_STRING, responseToken));

  const body = Buffer.concat([negStateField, supportedMechField, responseTokenField]);
  const negTokenResp = derTlv(DerTag.SEQUENCE, body);

  return derTlv(DerTag.CONTEXT_1, negTokenResp);
}

/** Builds the full SPNEGO NegTokenResp carrying an NTLMSSP CHALLENGE. */
export function buildSpnegoChallenge(serverChallenge: Buffer): Buffer {
  return buildNegTokenResp(buildNtlmChallenge(serverChallenge), 1 /* accept-incomplete */);
}

/** Builds a minimal SPNEGO NegTokenResp signalling successful authentication, with no token. */
export function buildSpnegoAcceptCompleted(): Buffer {
  const negStateField = derTlv(DerTag.CONTEXT_0, derTlv(DerTag.ENUMERATED, Buffer.from([0 /* accept-completed */])));
  const negTokenResp = derTlv(DerTag.SEQUENCE, negStateField);
  return derTlv(DerTag.CONTEXT_1, negTokenResp);
}

/** Locates the `NTLMSSP\0` signature in `token` and returns the MessageType dword that follows it, or -1. */
function ntlmMessageType(token: Buffer): number {
  const index = token.indexOf(NTLMSSP_SIGNATURE);
  if (index < 0 || index + 12 > token.length) {
    return -1;
  }
  return token.readUInt32LE(index + 8);
}

/** True if `token` contains an NTLMSSP NEGOTIATE (type 1) message. */
export function isNtlmNegotiate(token: Buffer): boolean {
  return ntlmMessageType(token) === 1;
}

/** True if `token` contains an NTLMSSP AUTHENTICATE (type 3) message. */
export function isNtlmAuthenticate(token: Buffer): boolean {
  return ntlmMessageType(token) === 3;
}

/**
 * True if `token` is a bare NTLMSSP message (the "NTLMSSP\0" signature at
 * offset 0), as sent by clients that skip SPNEGO/GSS-API framing entirely
 * (e.g. @marsaud/smb2, whose `ntlm` dependency both encodes and decodes raw
 * NTLM messages with no ASN.1 wrapper). Such clients also expect a bare
 * NTLM CHALLENGE back, not one wrapped in a SPNEGO NegTokenResp.
 */
export function isBareNtlmToken(token: Buffer): boolean {
  return token.indexOf(NTLMSSP_SIGNATURE) === 0;
}
