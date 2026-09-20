/*
 * Created on Fri Sep 19 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

/**
 * Pure-JS MD4 (RFC 1320). Needed for NTLM's NT hash (MD4 of the UTF-16LE
 * password): Node's OpenSSL 3 default provider no longer offers MD4, so
 * `crypto.createHash("md4")` throws `ERR_OSSL_EVP_UNSUPPORTED` unless the
 * process is started with the legacy provider enabled. Implementing MD4
 * directly avoids requiring that flag at runtime.
 */

function rotl(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number): number {
  const f = (b & c) | (~b & d);
  return rotl((a + f + x) >>> 0, s);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number): number {
  const g = (b & c) | (b & d) | (c & d);
  return rotl((a + g + x + 0x5a827999) >>> 0, s);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number): number {
  const h = b ^ c ^ d;
  return rotl((a + h + x + 0x6ed9eba1) >>> 0, s);
}

function padMessage(input: Buffer): Buffer {
  const bitLenLow = (input.length * 8) >>> 0;
  const bitLenHigh = Math.floor(input.length / 0x20000000);
  const padLen = ((56 - ((input.length + 1) % 64)) + 64) % 64;

  const padded = Buffer.alloc(input.length + 1 + padLen + 8);
  input.copy(padded, 0);
  padded[input.length] = 0x80;
  padded.writeUInt32LE(bitLenLow, padded.length - 8);
  padded.writeUInt32LE(bitLenHigh, padded.length - 4);
  return padded;
}

/** Computes the MD4 digest of `input`, per RFC 1320. */
export function md4(input: Buffer): Buffer {
  const padded = padMessage(input);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const x: number[] = new Array(16);
    for (let i = 0; i < 16; i++) {
      x[i] = padded.readUInt32LE(offset + i * 4);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    // Round 1
    a = ff(a, b, c, d, x[0], 3);
    d = ff(d, a, b, c, x[1], 7);
    c = ff(c, d, a, b, x[2], 11);
    b = ff(b, c, d, a, x[3], 19);
    a = ff(a, b, c, d, x[4], 3);
    d = ff(d, a, b, c, x[5], 7);
    c = ff(c, d, a, b, x[6], 11);
    b = ff(b, c, d, a, x[7], 19);
    a = ff(a, b, c, d, x[8], 3);
    d = ff(d, a, b, c, x[9], 7);
    c = ff(c, d, a, b, x[10], 11);
    b = ff(b, c, d, a, x[11], 19);
    a = ff(a, b, c, d, x[12], 3);
    d = ff(d, a, b, c, x[13], 7);
    c = ff(c, d, a, b, x[14], 11);
    b = ff(b, c, d, a, x[15], 19);

    // Round 2
    a = gg(a, b, c, d, x[0], 3);
    d = gg(d, a, b, c, x[4], 5);
    c = gg(c, d, a, b, x[8], 9);
    b = gg(b, c, d, a, x[12], 13);
    a = gg(a, b, c, d, x[1], 3);
    d = gg(d, a, b, c, x[5], 5);
    c = gg(c, d, a, b, x[9], 9);
    b = gg(b, c, d, a, x[13], 13);
    a = gg(a, b, c, d, x[2], 3);
    d = gg(d, a, b, c, x[6], 5);
    c = gg(c, d, a, b, x[10], 9);
    b = gg(b, c, d, a, x[14], 13);
    a = gg(a, b, c, d, x[3], 3);
    d = gg(d, a, b, c, x[7], 5);
    c = gg(c, d, a, b, x[11], 9);
    b = gg(b, c, d, a, x[15], 13);

    // Round 3
    a = hh(a, b, c, d, x[0], 3);
    d = hh(d, a, b, c, x[8], 9);
    c = hh(c, d, a, b, x[4], 11);
    b = hh(b, c, d, a, x[12], 15);
    a = hh(a, b, c, d, x[2], 3);
    d = hh(d, a, b, c, x[10], 9);
    c = hh(c, d, a, b, x[6], 11);
    b = hh(b, c, d, a, x[14], 15);
    a = hh(a, b, c, d, x[1], 3);
    d = hh(d, a, b, c, x[9], 9);
    c = hh(c, d, a, b, x[5], 11);
    b = hh(b, c, d, a, x[13], 15);
    a = hh(a, b, c, d, x[3], 3);
    d = hh(d, a, b, c, x[11], 9);
    c = hh(c, d, a, b, x[7], 11);
    b = hh(b, c, d, a, x[15], 15);

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const digest = Buffer.alloc(16);
  digest.writeUInt32LE(a0, 0);
  digest.writeUInt32LE(b0, 4);
  digest.writeUInt32LE(c0, 8);
  digest.writeUInt32LE(d0, 12);
  return digest;
}
