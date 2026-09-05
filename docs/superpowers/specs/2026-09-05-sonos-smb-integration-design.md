# Sonos SMB Integration — Design

## Goal

Expose the Music Server library over an SMB (SMB2/SMB3) share so that a
Sonos system can discover, browse, and stream/download the music. The
share presents an **artist → album → song** hierarchy and is
**read-only**. Delivered as a **plugin**, behind a new **sharing
protocol extension point** so future protocols can be added the same
way.

Source doc: Notion "Sonos integration". Repo `musicserver-backend`,
branch `feat/sonos`.

## Scope (this PR)

In scope:

- A minimal, clean-room **SMB2/SMB3 server** implemented in
  TypeScript, supporting only what Sonos needs: negotiate, session
  setup (anonymous), tree connect, browse (directory listing), and
  file read (download).
- **Anonymous access only** (guest session, no signing, no
  encryption).
- A new **sharing** plugin category with an abstract
  `SharingProtocolPlugin`, and a first implementation `SonosSmbPlugin`.
- Data read **directly from MongoDB** (`artists`, `albums`, `songs`
  collections); file bytes read directly from each song's on-disk
  `filePath`.
- Read-only enforcement: every write/create/delete/rename is rejected
  with an SMB error.

Explicitly out of scope (future PRs):

- Authentication (API-key or otherwise), SMB signing, SMB encryption.
- SMB 3.1.1 (pre-auth integrity, negotiate contexts, encryption).
- Album-art files, search, write access.
- Any change to how the library is scanned or stored.

## Constraints & key decisions

- **No pure-Node SMB2/3 server exists** (all npm SMB2/3 packages are
  clients; `node-smb-server` is SMB1 with only a negotiate stub for
  SMB2). Therefore the server is written from scratch.
- **Dialects:** advertise/accept `0x0202` (2.0.2), `0x0210` (2.1),
  `0x0300` (3.0). Skip 3.1.1 to avoid pre-auth integrity and negotiate
  contexts. Sonos S2 accepts SMB2/3.
- **Security:** anonymous/guest sessions. Signing advertised as
  *enabled but not required*; guest sessions are never signed
  (per MS-SMB2), so no signing code path is exercised. Encryption off.
- **Transport:** direct TCP on port 445 (Sonos uses the standard SMB
  port with no way to specify a custom one). Framing is the 4-byte
  session-message length prefix. Port is configurable for local
  development (445 is privileged and taken by the host SMB service on
  macOS); Sonos itself requires 445.
- **Data source:** MongoDB directly. Root lists artists
  (`ArtistDbModel.findAll`); an artist lists its albums
  (`AlbumDbModel.findAlbumsByArtistId`); an album lists its songs
  (`SongDbModel.findSongsByAlbumId`). Song bytes come from the file at
  `song.metadata.filePath`.

## Components

All new code lives under `src/plugins/sharing/` so the protocol
implementation ships with its plugin (the extension point).

### 1. Sharing extension point
- `src/plugins/sharing/` — new plugin category (folder = category).
- `SharingProtocolPlugin extends Plugin` — abstract base marking the
  category. Uses the existing `start()` / `stop()` lifecycle to boot
  and shut down its protocol server; may expose a `getStatus()` for
  served port / running state.

### 2. `SonosSmbPlugin`
- `src/plugins/sharing/sonos-smb/index.ts` — default export.
- `start()` builds the library data source + boots the SMB server on
  the configured port; `stop()` closes it. A start failure is logged
  and reflected in plugin status; it never crashes the app.
- Configuration (existing plugin-config mechanism, persisted in DB):
  `port` (default `445`), `shareName` (default `Music`), `enabled`.

### 3. SMB2 server core — `src/plugins/sharing/sonos-smb/smb/`
- `server.ts` — `net` TCP server; per-connection read loop; NetBIOS
  session framing (4-byte length prefix); dispatch by SMB2 command.
- `codec/` — pure functions to parse and serialize the SMB2 header and
  each supported message's request/response structures. No I/O; unit
  tested with round-trip tests.
- `session.ts` — per-connection state: negotiated dialect, session id,
  tree id, and a map of open handles (fileId → resolved library node).
- Command handlers (the subset Sonos exercises):
  - `NEGOTIATE` — choose the highest common dialect; return server
    GUID, capabilities, max read/transact sizes, security mode
    (signing enabled, not required), and a SPNEGO/NTLMSSP security
    buffer. No negotiate contexts (3.1.1 not offered).
  - `SESSION_SETUP` — drive NTLMSSP: on the type-1 (negotiate) token,
    reply with a type-2 challenge and `STATUS_MORE_PROCESSING_REQUIRED`;
    on the type-3 (authenticate) token, **accept unconditionally** and
    return a **guest** session (`SMB2_SESSION_FLAG_IS_GUEST`).
  - `TREE_CONNECT` — accept `\\<host>\<shareName>`; return a disk-type,
    read-only tree. Reject other share names.
  - `CREATE` — open a directory or file resolved from the path; reject
    any create disposition or desired access implying writes. Return a
    file id plus basic attributes.
  - `QUERY_DIRECTORY` — list a directory's children, emitting the info
    class the client requests (at least `FileBothDirectoryInformation`
    and `FileIdBothDirectoryInformation`), including `.` and `..`.
  - `QUERY_INFO` — file basic/standard information and filesystem
    information (attributes, sizes, read-only volume).
  - `READ` — return up to the requested length of a song's bytes from
    `filePath`, honoring the offset.
  - `CLOSE`, `TREE_DISCONNECT`, `LOGOFF` — release state.
  - `IOCTL` — answer `FSCTL_VALIDATE_NEGOTIATE_INFO`; other codes →
    `STATUS_NOT_SUPPORTED`.
  - `ECHO`, `CANCEL`, `FLUSH` — trivial success responses.

### 4. Library data source — `src/plugins/sharing/sonos-smb/library/`
- `libraryTree.ts` — maps SMB paths (name-based) to library nodes,
  read directly from Mongo:
  - root → artists (`ArtistDbModel.findAll`).
  - artist → albums (`AlbumDbModel.findAlbumsByArtistId`).
  - album → songs (`SongDbModel.findSongsByAlbumId`).
  - Path resolution walks one segment at a time, matching display
    names to ids (SMB clients navigate by name, the DB by id).
- **Naming:**
  - Artist / album folders: sanitized `name`.
  - Song files: `<zero-padded track> - <title><ext>` where `<ext>`
    comes from the real `filePath` extension (authoritative).
  - Illegal SMB characters replaced; duplicate names within one listing
    get a ` (n)` suffix. Deduplication is deterministic (DB sort order
    is stable), so a name resolves back to the same id.
- **File access** — size via `fs.stat(filePath)`; bytes via a file
  descriptor read at the requested offset/length. Read-only.

## Data flow

```
Sonos --SMB2--> server dispatch
  CREATE(dir)/QUERY_DIRECTORY  -> libraryTree -> Mongo (artists/albums/songs)
  CREATE(file)/READ            -> libraryTree -> song.filePath -> fs read
```

## Error handling (→ NTSTATUS)

- Path not found → `STATUS_OBJECT_NAME_NOT_FOUND`.
- Write / create-for-write / delete / rename → `STATUS_ACCESS_DENIED`.
- Unsupported command or info class → `STATUS_NOT_SUPPORTED` /
  `STATUS_INVALID_INFO_CLASS`.
- Server bind failure → plugin logs and reports error status; the rest
  of the app keeps running.

## Testing

- **Codec unit tests** — parse↔serialize round-trips for the SMB2
  header and each supported message.
- **Library resolver unit tests** — name↔id path resolution, song file
  naming, dedup, read slicing (mocked Mongo + fs).
- **Integration test** — drive the running server with an npm SMB2
  **client** (`@marsaud/smb2`, dev-only) on an ephemeral port:
  negotiate → session (anonymous) → tree connect → list artists →
  descend to a song → read bytes. No Sonos required. Real Sonos uses
  the same protocol on port 445.

## Known caveats

- SMB 3.1.1 not supported; if a future client refuses ≤3.0 it won't
  connect (Sonos S2 is fine).
- Anonymous only — the library is exposed without authentication while
  this is enabled. Authentication is a separate, planned PR.
- Direct `filePath` read assumes the scanning plugin stored a readable
  local path (true for the filesystem music source).
- Port 445 needs privilege; local dev/tests use a high port via config.
