# Music Server

Music Server is a Fastify-based backend with a web administration interface to manage installed plugins.

## Access the Admin UI

Open:

- `http://localhost:3000/admin`

The page shows all installed plugins in one table with current status and available actions.

## Buttons behavior

Buttons are shown depending on the plugin status.

### When plugin status is `started` (active)

- **Scan**
  - Triggers a scan for the selected plugin (only for scannable categories such as music plugins)
- **Stop**
  - Invokes plugin `stop()` and updates plugin status in MongoDB to `stopped`

### When plugin status is not `started` (non-active)

- **Start**
  - Invokes plugin `start()` and updates plugin status in MongoDB to `started`
