import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAccess = vi.fn();
const mockReadFile = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

const mockGenerate = vi.fn();

vi.mock("selfsigned", () => ({
  default: { generate: (...args: unknown[]) => mockGenerate(...args) },
}));

import { loadTlsConfig } from "../../src/tls/tlsManager.js";

const FAKE_CERT = "-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----\n";
const FAKE_KEY = "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n";
const ENOENT = Object.assign(new Error("ENOENT"), { code: "ENOENT" });

describe("loadTlsConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns null when HTTPS_ENABLED is false", async () => {
    vi.stubEnv("HTTPS_ENABLED", "false");
    const result = await loadTlsConfig();
    expect(result).toBeNull();
  });

  it("returns null when HTTPS_ENABLED is absent", async () => {
    delete process.env.HTTPS_ENABLED;
    const result = await loadTlsConfig();
    expect(result).toBeNull();
  });

  it("loads existing cert and key files when both exist", async () => {
    vi.stubEnv("HTTPS_ENABLED", "true");
    vi.stubEnv("TLS_CERT_PATH", "/certs/server.crt");
    vi.stubEnv("TLS_KEY_PATH", "/certs/server.key");

    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockImplementation((p: string) => {
      if (p === "/certs/server.crt") return Promise.resolve(Buffer.from(FAKE_CERT));
      if (p === "/certs/server.key") return Promise.resolve(Buffer.from(FAKE_KEY));
      return Promise.reject(new Error(`unexpected path: ${p}`));
    });

    const result = await loadTlsConfig();

    expect(result).not.toBeNull();
    expect(result!.cert.toString()).toBe(FAKE_CERT);
    expect(result!.key.toString()).toBe(FAKE_KEY);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("auto-generates cert when both files are missing", async () => {
    vi.stubEnv("HTTPS_ENABLED", "true");
    vi.stubEnv("TLS_CERT_PATH", "/certs/server.crt");
    vi.stubEnv("TLS_KEY_PATH", "/certs/server.key");

    mockAccess.mockRejectedValue(ENOENT);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockGenerate.mockResolvedValue({ cert: FAKE_CERT, private: FAKE_KEY });

    const result = await loadTlsConfig();

    expect(result).not.toBeNull();
    expect(mockMkdir).toHaveBeenCalledWith("/certs", { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it("throws when only one of cert/key file exists", async () => {
    vi.stubEnv("HTTPS_ENABLED", "true");
    vi.stubEnv("TLS_CERT_PATH", "/certs/server.crt");
    vi.stubEnv("TLS_KEY_PATH", "/certs/server.key");

    mockAccess.mockImplementation((p: string) => {
      if (p === "/certs/server.crt") return Promise.resolve();
      return Promise.reject(ENOENT);
    });

    await expect(loadTlsConfig()).rejects.toThrow("Partial cert state");
  });
});
