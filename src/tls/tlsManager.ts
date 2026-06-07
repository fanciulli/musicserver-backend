import * as fs from "node:fs/promises";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import selfsigned from "selfsigned";

const DEFAULT_CERT_PATH = "config/certs/server.crt";
const DEFAULT_KEY_PATH = "config/certs/server.key";
const CERT_VALIDITY_DAYS = 825;

export interface TlsConfig {
  key: Buffer;
  cert: Buffer;
}

export async function loadTlsConfig(): Promise<TlsConfig | null> {
  const httpsEnabled = process.env.HTTPS_ENABLED ?? "false";
  if (httpsEnabled !== "true") {
    return null;
  }

  const certPath = process.env.TLS_CERT_PATH ?? DEFAULT_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH ?? DEFAULT_KEY_PATH;

  return await ensureCert(certPath, keyPath);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureCert(
  certPath: string,
  keyPath: string,
): Promise<TlsConfig> {
  const certExists = await fileExists(certPath);
  const keyExists = await fileExists(keyPath);

  if (certExists && keyExists) {
    const cert = await fs.readFile(certPath);
    const key = await fs.readFile(keyPath);
    return { cert, key };
  }

  if (certExists !== keyExists) {
    const missing = certExists ? keyPath : certPath;
    const present = certExists ? certPath : keyPath;
    throw new Error(
      `[TLS] Partial cert state: ${present} exists but ${missing} does not. ` +
        `Provide both files or remove both to auto-generate.`,
    );
  }

  console.warn(
    `[TLS] Cert not found at ${certPath}. Generating self-signed certificate.`,
  );
  return await generateAndPersist(certPath, keyPath);
}

async function generateAndPersist(
  certPath: string,
  keyPath: string,
): Promise<TlsConfig> {
  const attrs = [{ name: "commonName", value: "musicserver" }];
  const notAfterDate = new Date(Date.now() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const pems = await selfsigned.generate(attrs, {
    notAfterDate,
    algorithm: "sha256",
    keySize: 2048,
  });

  const certDir = path.dirname(certPath);
  await fs.mkdir(certDir, { recursive: true });
  await fs.writeFile(certPath, pems.cert, { encoding: "utf8" });
  await fs.writeFile(keyPath, pems.private, { encoding: "utf8", mode: 0o600 });

  return { cert: Buffer.from(pems.cert), key: Buffer.from(pems.private) };
}
