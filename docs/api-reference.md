# Music Server – API Reference

A machine-readable [OpenAPI 3.0 specification](./openapi.yaml) is available for download.
It can be imported directly into tools such as Swagger UI, Postman, or Insomnia.

- [← README](../README.md)
- [Introduction](./introduction.md)
- [Architecture](./architecture.md)
- [Building Blocks](./building-blocks.md)

The following sections summarise each endpoint.

---

## Authentication

The API uses two authentication schemes:

- **API key** – protects the client-facing music endpoints (`/music/browse`,
  `/music/search`, `/music/stream`). Send the key in the `x-api-key` header
  (it may also be supplied as an `apiKey` query parameter). API keys are issued
  through the admin `/admin/api-keys` endpoints.
- **Session token** – protects the administrative endpoints (everything under
  `/admin`, except `/admin/login`). Obtain a token from `POST /admin/login` and
  send it as a Bearer token in the `Authorization` header.

A handful of endpoints are public and require no authentication: `GET /healthz`,
`GET /music/albumart` and `POST /admin/login`.

Endpoints that require authentication return `401` when the credential is
missing or invalid.

---

## Health

### `GET /healthz`

Returns the operational status of the server. **Public.**

**Response `200`**

```json
{ "status": "OK" }
```

---

## Auth

### `POST /admin/login`

Authenticates an administrator and returns a session token. **Public.**
Repeated failed attempts from the same client are rate limited.

**Request body**

```json
{ "username": "admin", "password": "password" }
```

**Response `200`**

```json
{ "token": "<session-token>", "expiresAt": "2026-06-26T13:38:01.000Z" }
```

**Response `401`** – invalid username or password

**Response `429`** – too many failed attempts; try again later

---

### `POST /admin/logout`

Invalidates the current administrator session. **Session auth.**

**Response `200`**

```json
{ "success": true }
```

---

### `POST /admin/change-password`

Updates the administrator password. **Session auth.**
All existing sessions for the user are invalidated on success.

**Request body**

```json
{ "currentPassword": "password", "newPassword": "newPassword" }
```

| Field             | Type   | Required | Description                       |
| ----------------- | ------ | -------- | --------------------------------- |
| `currentPassword` | string | Yes      | Current password (8–64 chars)     |
| `newPassword`     | string | Yes      | New password (8–64 chars)         |

**Response `200`** – password changed successfully

**Response `401`** – missing/invalid session token or wrong current password

---

## Music

### `POST /music/browse`

Navigates the music library hierarchy. **API key auth.**
Calling with `"/"` (or an empty string) returns the list of active music-source plugins as top-level folders.
Providing a plugin-scoped URI (e.g. `filesystem-music-source://albums/A`) delegates to the corresponding plugin.

**Request body**

```json
{ "path": "/" }
```

**Response `200`** – array of `BrowseItem` objects

When called with `"/"`, the response lists the active music-source plugins as top-level folders:

```json
[
  {
    "id": "filesystem-music-source://",
    "type": "folder",
    "metadata": { "name": "Filesystem Music Source" }
  }
]
```

When called with a plugin-scoped URI (e.g. `filesystem-music-source://albums/`), the response contains the items inside that path:

```json
[
  {
    "id": "filesystem-music-source://albums/A/uuid-123/uuid-456",
    "type": "song",
    "metadata": {
      "title": "My Song",
      "artist": "Some Artist",
      "album": "Some Album",
      "duration": 213,
      "trackNumber": 3
    }
  }
]
```

**Response `404`** – music source plugin not found

**Response `409`** – music source plugin is not started

---

### `POST /music/search`

Searches the music library across all active music-source plugins, or within a specific plugin when `scheme` is provided. **API key auth.**

**Request body**

```json
{ "query": "nirvana", "category": "album", "scheme": "filesystem-music-source" }
```

| Field      | Type                                | Required | Description                                                      |
| ---------- | ----------------------------------- | -------- | ---------------------------------------------------------------- |
| `query`    | string                              | Yes      | Search term                                                      |
| `category` | `"album"` \| `"artist"` \| `"song"` | Yes      | Type of content to search                                        |
| `scheme`   | string                              | No       | Restricts the search to a single plugin identified by its scheme |

**Response `200`** – flat array of `BrowseItem` objects matching the query

**Response `404`**

```json
{ "error": "Specified plugin not found or not searchable" }
```

---

### `GET /music/stream`

Streams an audio file to the client. **API key auth.**

**Parameters**

| Parameter | Type          | Required | Description                                    |
| --------- | ------------- | -------- | ---------------------------------------------- |
| `id`      | query string  | Yes      | Song URI returned by `/music/browse`           |
| `range`   | header string | No       | Partial playback request (e.g. `bytes=12345-`) |

**Response `200`** – binary audio stream

Headers:

- `accept-ranges: bytes`
- `content-length: <size>`

**Response `206`** – partial binary audio stream (when `range` is provided)

Headers:

- `accept-ranges: bytes`
- `content-length: <size>`

**Response `404`**

```json
{ "error": "Song not found" }
```

**Response `409`** – music source plugin is not started

---

### `GET /music/albumart`

Returns the cover art image for an album. **Public.**

**Query parameters**

| Parameter | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| `id`      | string | Yes      | Album URI or UUID |

**Response `200`** – binary image (`application/octet-stream`)

If no album art is found for the given `id`, a default SVG placeholder image (`image/svg+xml`) is returned with status `200`.

**Response `404`**

```json
{ "error": "Album art not found" }
```

Returned only when an unexpected error occurs while retrieving the art.

---

### `POST /admin/scan`

Triggers a content scan for the specified plugin. **Session auth.**
The plugin discovers and indexes its sources and persists the results.

**Request body**

```json
{ "id": "filesystem-music-source" }
```

**Response `200`**

```json
{ "status": "Scan initiated" }
```

**Response `404`** – music source plugin not found

**Response `409`** – music source plugin is not started

---

## Library

All library endpoints require **session auth** and operate on the indexed
content stored in the database.

### `GET /admin/db/summary`

Returns the number of indexed artists, albums and songs.

**Response `200`**

```json
{ "artists": 42, "albums": 128, "songs": 1536 }
```

---

### `GET /admin/db/artists`

Returns all artists stored in the library index.

**Response `200`**

```json
[
  {
    "id": "e32e2600-5143-4b6e-acbe-7494b005396f",
    "name": "Some Artist",
    "pluginId": "..."
  }
]
```

---

### `GET /admin/db/artists/{artistId}/albums`

Returns the albums that belong to the given artist.

**Path parameters**

| Parameter  | Type   | Required | Description |
| ---------- | ------ | -------- | ----------- |
| `artistId` | string | Yes      | Artist UUID |

**Response `200`** – array of album objects

**Response `404`** – artist not found

---

### `GET /admin/db/albums/{albumId}/songs`

Returns the songs that belong to the given album.

**Path parameters**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `albumId` | string | Yes      | Album UUID  |

**Response `200`** – array of song objects (`id`, `name`, `pluginId`, `trackNumber`, `duration`)

**Response `404`** – album not found

---

## Plugins

All plugin endpoints require **session auth.**

### `GET /admin/plugins`

Lists all registered plugins and their current status.

**Response `200`**

```json
[
  {
    "id": "filesystem-music-source",
    "name": "Filesystem Music Source",
    "category": "music_sources",
    "status": "started"
  }
]
```

---

### `POST /admin/plugins/start`

Starts a plugin.

**Request body**

```json
{ "pluginId": "filesystem-music-source" }
```

**Response `200`**

```json
{ "status": "Plugin started" }
```

**Response `404`**

```json
{ "error": "Plugin filesystem-music-source not found" }
```

---

### `POST /admin/plugins/stop`

Stops a running plugin.

**Request body**

```json
{ "pluginId": "filesystem-music-source" }
```

**Response `200`**

```json
{ "status": "Plugin stopped" }
```

**Response `404`**

```json
{ "error": "Plugin filesystem-music-source not found" }
```

---

### `GET /admin/plugins/{pluginId}/config`

Returns configuration settings for a plugin.

**Path parameters**

| Parameter  | Type   | Required | Description |
| ---------- | ------ | -------- | ----------- |
| `pluginId` | string | Yes      | Plugin ID   |

**Response `200`** – plugin configuration object

**Response `404`**

```json
{ "error": "Plugin filesystem-music-source not found" }
```

---

### `PUT /admin/plugins/{pluginId}/config`

Updates plugin configuration and returns the persisted settings.

**Path parameters**

| Parameter  | Type   | Required | Description |
| ---------- | ------ | -------- | ----------- |
| `pluginId` | string | Yes      | Plugin ID   |

**Request body**

```json
{ "settings": { "someKey": "someValue" } }
```

**Response `200`** – updated plugin configuration object

**Response `400`**

```json
{ "error": "Invalid plugin configuration payload" }
```

**Response `404`**

```json
{ "error": "Plugin filesystem-music-source not found" }
```

---

## API Keys

All API key endpoints require **session auth.**

### `GET /admin/api-keys`

Lists all issued API keys. The plaintext key is never returned; only a
non-sensitive prefix is included.

**Response `200`**

```json
[
  {
    "id": "uuid",
    "name": "My Client",
    "keyPrefix": "ms_4f6f",
    "createdAt": "2026-06-25T13:38:01.000Z",
    "expiresAt": "2027-06-25T13:38:01.000Z"
  }
]
```

---

### `POST /admin/api-keys`

Creates a new API key. The plaintext key is returned **only once** in the
response and cannot be retrieved later.

**Request body**

```json
{ "name": "My Client", "durationDays": 365 }
```

| Field          | Type           | Required | Description                                              |
| -------------- | -------------- | -------- | -------------------------------------------------------- |
| `name`         | string         | Yes      | Human-readable name (1–64 chars)                         |
| `durationDays` | integer\|null  | Yes      | Days until expiry, or `null` for a key that never expires |

**Response `200`**

```json
{
  "id": "uuid",
  "name": "My Client",
  "key": "ms_4f6f898c...",
  "createdAt": "2026-06-25T13:38:01.000Z",
  "expiresAt": "2027-06-25T13:38:01.000Z"
}
```

---

### `DELETE /admin/api-keys/{id}`

Revokes and deletes the API key with the given ID.

**Path parameters**

| Parameter | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| `id`      | string | Yes      | API key ID   |

**Response `200`** – API key deleted

**Response `404`** – API key not found

---

## Notifications

All notification endpoints require **session auth.**

### `GET /admin/notifications`

Returns the notifications visible to the current administrator.

**Response `200`**

```json
[
  {
    "id": "uuid",
    "title": "Scan complete",
    "message": "The library scan finished successfully.",
    "type": "success",
    "createdAt": "2026-06-25T13:38:01.000Z",
    "read": false
  }
]
```

`type` is one of `info`, `success`, `warning` or `error`.

---

### `POST /admin/notifications/{id}/read`

Marks the given notification as read for the current administrator.

**Path parameters**

| Parameter | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| `id`      | string | Yes      | Notification ID |

**Response `200`** – notification marked as read

**Response `404`** – notification not found

---

### `DELETE /admin/notifications/{id}`

Deletes the given notification.

**Path parameters**

| Parameter | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| `id`      | string | Yes      | Notification ID |

**Response `200`** – notification deleted

**Response `404`** – notification not found

---

## Admin

### `GET /admin/logs`

Returns the latest rotated log file content for a logger. **Session auth.**

**Query parameters**

| Parameter | Type   | Required | Description                     |
| --------- | ------ | -------- | ------------------------------- |
| `id`      | string | Yes      | Logger ID (`main` or `fastify`) |

**Response `200`** – plain text content

**Response `404`**

```json
{ "error": "Log file not found" }
```

---

## Wizards

All wizard endpoints require **session auth.**

### `GET /admin/wizards/next`

Returns the next onboarding wizard that has not yet been shown to the current
administrator, then marks it as shown.

**Response `200`**

```json
{
  "id": "filesystem-music-source",
  "steps": [
    { "image": "filesystem-music-source.png", "text": "Welcome!" }
  ]
}
```

**Response `204`** – no further wizards to display

---

### `GET /admin/wizards/images/{filename}`

Returns an image referenced by a wizard step.

**Path parameters**

| Parameter  | Type   | Required | Description                                                                    |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------ |
| `filename` | string | Yes      | Image file name (letters, digits, dots, hyphens and underscores; max 64 chars) |

**Response `200`** – binary image data

**Response `404`** – image not found or invalid file name
