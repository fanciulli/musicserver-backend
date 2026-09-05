# Sonos SMB Sharing Plugin

The **Sonos SMB Share** plugin exposes the music library as a **read-only SMB2/SMB3 share**,
browsable as `artist → album → song`. It lets Sonos speakers (and any other SMB2/3 client)
mount the library as a network music share without going through the REST API.

The plugin lives at `src/plugins/device_connectors/sonos-smb/` and belongs to the
`device_connectors` plugin category (`src/types/plugins/sharingProtocolPlugin.ts`), a
sibling of the `music_sources` category used by source plugins such as the filesystem music
source.

---

## What it does

- Implements a minimal **SMB2/SMB3 server** directly on top of a raw TCP socket (NetBIOS
  session-service framing, no dependency on Samba or the OS SMB stack).
- Presents a single share (name configurable, default `Music`).
- The share root lists **artists** (from MongoDB), each artist directory lists **albums**,
  and each album directory lists **songs** as individual files.
- Song files are named `<NN> - <title><ext>` (e.g. `01 - Come Together.flac`); the `<NN> - `
  track-number prefix is omitted when the song has no track number, and duplicate names are
  disambiguated with a ` (n)` suffix.
- File contents are streamed directly from each song's on-disk path — nothing is transcoded
  or buffered into a temporary copy.

---

## Configuration

Configuration is a regular plugin configuration, persisted in MongoDB (`pluginConfig`
collection) and editable through the same plugin-configuration mechanism as any other plugin.

| Key         | Type       | Default   | Description                                                       |
| ----------- | ---------- | --------- | -------------------------------------------------------------------|
| `shareName` | `string`   | `"Music"` | Name of the share, as it appears to SMB clients (e.g. Sonos).      |
| `username`  | `string`   | `""`      | Username Sonos must authenticate with.                             |
| `password`  | `password` | `""`      | Password Sonos must authenticate with. Stored and returned in plaintext (see below). |

The server always listens on TCP port `445`, SMB's well-known port — Sonos and other SMB
clients expect the share there, so the port is fixed and not configurable.

Whether the SMB server runs at all is controlled by the plugin's start/stop state (the same
generic mechanism used by every plugin), not by a setting in this configuration.

**The password is stored in plaintext** in the `pluginConfigs` collection, and
`getConfiguration()` returns it as-is, so the UI can display/edit it. This is a deliberate
choice: anyone who can read that collection reads the real password (reusable against
whatever else the user reused it on), not just an NTLM-specific value. The NT hash
(`MD4(UTF-16LE(password))`, see `smb/ntlmAuth.ts`) needed for NTLMv2 verification is derived
from this plaintext at server-start time, not stored separately. Until `username`/`password`
are configured, no login can succeed (empty credentials never match).

---

## Access model

- **NTLMv2 username/password.** `SESSION_SETUP` requires a valid NTLMv2 challenge-response
  matching the configured `username`/`password`; anything else (wrong username, wrong
  password, or an NTLMv1-only client — see Limitations) is rejected with
  `STATUS_LOGON_FAILURE`. There is no anonymous/guest fallback.
- **Read-only.** There is no support for writing, renaming, or deleting files or directories.
  `CREATE` only allows opening existing files/directories for reading; any request implying a
  write (or an unimplemented SET_INFO-style operation) is rejected with the corresponding SMB2
  error status instead of being silently accepted.

---

## Protocol scope

- **Supported dialects:** SMB 2.0.2, SMB 2.1, and SMB 3.0.
- **Not supported:** SMB 1 (CIFS) and SMB 3.1.1. Clients that negotiate only one of those
  dialects cannot connect.
- **No signing and no encryption.** The server does not negotiate SMB message signing or
  SMB3 encryption; traffic (including the NTLM handshake) is sent in the clear.
- Implements the subset of the SMB2 command set needed for read-only browsing and download:
  `NEGOTIATE`, `SESSION_SETUP`, `TREE_CONNECT`, `CREATE`, `QUERY_DIRECTORY`, `QUERY_INFO`,
  `READ`, `CLOSE`, `TREE_DISCONNECT`, `LOGOFF`, `IOCTL`/`ECHO`/`FLUSH` (handled as no-ops or
  rejected where a write would be implied).

This is **not a REST surface** — it speaks the SMB2/3 binary protocol over its own TCP port,
so it has no corresponding entry in `docs/openapi.yaml` or the Bruno collection, and none is
expected.

---

## Sonos setup

1. Configure `username` and `password` in the plugin settings, then make sure the plugin is
   started and the server has network access to port `445` from the Sonos speakers.
2. In the Sonos app: **Settings → System → Music Library Setup → Add Music Library on Network**.
3. Enter the share as `\\<host>\Music` (replace `<host>` with the Music Server's hostname or
   IP address, and `Music` with your configured `shareName`).
4. When prompted for credentials, enter the `username`/`password` configured in step 1 (not
   Guest).
5. Sonos indexes the share and lists it as a music source, browsable by artist and album.

---

## Limitations and notes

- **Port 445 is privileged and fixed.** Binding to it requires elevated privileges (root) on
  Linux, or a container/host configuration that allows binding privileged ports. The plugin
  does not support listening on a different port; if `445` cannot be bound, the plugin logs
  an error and stays stopped until it can be bound.
- **SMB1-only and SMB 3.1.1-only clients are unsupported.** Since the server only negotiates
  2.0.2/2.1/3.0, clients that require one of the unsupported dialects will fail to connect.
- **NTLMv2 only.** Clients whose SMB stack only implements NTLMv1 (the classic DES-based
  challenge-response) cannot authenticate — their AUTHENTICATE response is rejected as
  `STATUS_LOGON_FAILURE`. This is a deliberate choice: NTLMv1 depends on DES, which (like
  MD4) has no OpenSSL 3 default-provider support, and is cryptographically weaker than
  NTLMv2 regardless.
- **No signing/encryption.** Traffic is unencrypted; treat the share the same way you would
  treat any other unencrypted network share, even though it's now credentialed.

---

## Testing

Unit tests cover the SMB2 header codec, framing, each command handler individually, the pure-JS
MD4 implementation (`smb/md4.ts`, checked against the RFC 1320 test suite), and NTLMv2
authentication (`sessionSetup.test.ts`): a hand-built client-side NTLMv2 response is used to
verify both the accept and reject paths (wrong username, wrong password, unconfigured
credentials) against `handleSessionSetup` directly.

An end-to-end integration test additionally boots the plugin's real `SmbServer` and drives it
with a real SMB2 client, [`@marsaud/smb2`](https://www.npmjs.com/package/@marsaud/smb2) (a
dev-only dependency, not used at runtime). That client's transitive `ntlm` dependency only
speaks NTLMv1 (and relies on a legacy OpenSSL provider for it, which is why the `test` and
`test:coverage` npm scripts already run with `NODE_OPTIONS=--openssl-legacy-provider`), so it
can no longer complete a real login against this server; the integration test instead confirms
such a client is rejected. The successful-login path is exercised at the handler level instead
(see above), since no NTLMv2-capable client library is available here:

```bash
npm test
npm run test:coverage
```

No extra setup is needed to run the Sonos SMB integration test — it is included automatically
when running the standard test suite above.

---

- [← README](../../README.md)
- [Introduction](../introduction.md)
- [Building Blocks](../building-blocks.md)
