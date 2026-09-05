import { describe, it, expect } from "vitest";
import { frame, MessageAssembler } from "../../../../src/plugins/device_connectors/sonos-smb/smb/framing.js";

describe("NetBIOS framing", () => {
  it("reassembles messages split across chunks", () => {
    const a = frame(Buffer.from("hello"));
    const b = frame(Buffer.from("world"));
    const stream = Buffer.concat([a, b]);
    const asm = new MessageAssembler();
    const first = asm.push(stream.subarray(0, 4)); // partial
    const rest = asm.push(stream.subarray(4));
    expect(first).toEqual([]);
    expect(rest.map((m) => m.toString())).toEqual(["hello", "world"]);
  });
});
