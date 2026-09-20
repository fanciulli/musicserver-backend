import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { size, read } from "../../../../src/plugins/device_connectors/sonos-smb/library/fileReader.js";

describe("fileReader", () => {
  const filePath = path.join(os.tmpdir(), `fileReader-test-${process.pid}.txt`);

  afterEach(() => {
    fs.rmSync(filePath, { force: true });
  });

  it("returns the file size and reads a byte range", async () => {
    fs.writeFileSync(filePath, "ABCDEFGH");

    await expect(size(filePath)).resolves.toBe(8);

    const chunk = await read(filePath, 2, 3);
    expect(chunk.toString("utf8")).toBe("CDE");
  });
});
