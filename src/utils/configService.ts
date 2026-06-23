/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Db } from "mongodb";
import {
  getAllDefinitions,
  getDefinition,
  type ConfigType,
  type ConfigValue,
} from "../misc/configRegistry.js";
import {
  ServerConfigDBModel,
  type ServerConfigEntry,
} from "../types/db/serverConfig.js";

export interface ConfigItem {
  key: string;
  label: string;
  type: ConfigType;
  value: ConfigValue;
}

export interface ConfigUpdateError {
  error: string;
}

export async function getConfig(db: Db): Promise<ConfigItem[]> {
  const stored = await ServerConfigDBModel.findAll(db);
  const storedByKey = new Map(stored.map((e) => [e.key, e.value]));

  return getAllDefinitions().map((def) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    value: storedByKey.get(def.key) ?? def.defaultValue,
  }));
}

export async function updateConfig(
  db: Db,
  values: Record<string, unknown>,
): Promise<ConfigItem[] | ConfigUpdateError> {
  const entries: ServerConfigEntry[] = [];

  for (const [key, value] of Object.entries(values)) {
    const def = getDefinition(key);
    if (!def) {
      return { error: `Unknown configuration key: ${key}` };
    }

    const validationError = def.validate(value);
    if (validationError !== null) {
      return { error: validationError };
    }

    entries.push({ key, value: value as ConfigValue });
  }

  await ServerConfigDBModel.upsertMany(db, entries);
  return getConfig(db);
}
