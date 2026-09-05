/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

const LENGTH_PREFIX_SIZE = 4;

/**
 * Wraps an SMB2 payload in a NetBIOS session message framing: a 4-byte
 * big-endian length prefix whose top byte is always 0.
 */
export function frame(payload: Buffer): Buffer {
  const header = Buffer.alloc(LENGTH_PREFIX_SIZE);
  header.writeUInt32BE(payload.length & 0x00ffffff, 0);
  return Buffer.concat([header, payload]);
}

/**
 * Reassembles NetBIOS-framed SMB2 messages arriving across arbitrary TCP
 * chunk boundaries, returning any complete payloads found in each push.
 */
export class MessageAssembler {
  #buffer: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Buffer[] {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);

    const messages: Buffer[] = [];

    for (;;) {
      if (this.#buffer.length < LENGTH_PREFIX_SIZE) {
        break;
      }

      const length = this.#buffer.readUInt32BE(0) & 0x00ffffff;
      const totalLength = LENGTH_PREFIX_SIZE + length;

      if (this.#buffer.length < totalLength) {
        break;
      }

      messages.push(this.#buffer.subarray(LENGTH_PREFIX_SIZE, totalLength));
      this.#buffer = this.#buffer.subarray(totalLength);
    }

    return messages;
  }
}
