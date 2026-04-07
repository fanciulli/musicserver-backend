# Music Server – API Reference

A machine-readable [OpenAPI 3.0 specification](./openapi.yaml) is available for download.
It can be imported directly into tools such as Swagger UI, Postman, or Insomnia.

The following sections summarise each endpoint.

---

### `GET /healthz`

Returns the operational status of the server.

**Response `200`**

```json
{ "status": "OK" }
```

---

### `POST /music/browse`

Navigates the music library hierarchy.
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

---

### `POST /music/scan`

Triggers a content scan for the specified plugin.
The plugin discovers and indexes its sources and persists the results.

**Request body**

```json
{ "id": "filesystem-music-source" }
```

**Response `200`**

```json
{ "status": "Scan completed" }
```

---

### `GET /music/stream`

Streams an audio file to the client.

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

---

### `GET /music/albumart`

Returns the cover art image for an album.

**Query parameters**

| Parameter | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| `id`      | string | Yes      | Album URI or UUID |

**Response `200`** – binary image (`application/octet-stream`)

**Response `404`**

```json
{ "error": "Album art not found" }
```

---

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

### `GET /admin/logs`

Returns the latest rotated log file content for a logger.

**Query parameters**

| Parameter | Type   | Required | Description                     |
| --------- | ------ | -------- | ------------------------------- |
| `id`      | string | Yes      | Logger ID (`main` or `fastify`) |

**Response `200`** – plain text content

**Response `404`**

```json
{ "error": "Log file not found" }
```
