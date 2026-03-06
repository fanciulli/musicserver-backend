/*
 * Created on Fri Feb 27 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

/**
 * Extracts normalized path sections for a plugin browse path.
 *
 * Expected input format is `<pluginId>://...`.
 *
 * Returns:
 * - `null` when the path does not belong to the provided plugin id
 * - `[]` for plugin root path (`<pluginId>://`)
 * - an array of non-empty sections for nested paths
 */
export function extractPathSections(
  pluginId: string,
  path: string,
): string[] | null {
  const prefix = `${pluginId}://`;
  if (!path.startsWith(prefix)) {
    return null;
  }

  const remainder = path.slice(prefix.length);
  if (remainder.length === 0) {
    return [];
  }

  return remainder.split("/").filter((section) => section.length > 0);
}

/**
 * Extracts the plugin id from a given uri.
 *
 * Expected input format is `<pluginId>://...`.
 *
 * @param uri The uri from which to extract the plugin id.
 * @returns The extracted plugin id.
 */
export function extractPluginId(uri: string): string {
  return uri.substring(0, uri.indexOf(":"));
}
