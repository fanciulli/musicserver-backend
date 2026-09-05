/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import type {
  PluginConfigurationSettings,
  PluginConfigurationValues,
} from "../../../types/plugins/plugin.js";
import { PluginConfigDBModel } from "../../../types/db/pluginConfig.js";

const SHARE_NAME_KEY = "shareName";
const USERNAME_KEY = "username";
const PASSWORD_KEY = "password";

const LABEL_SHARE_NAME = "Share name";
const LABEL_USERNAME = "Username";
const LABEL_PASSWORD = "Password";

/** SMB requires its well-known port; not user-configurable. */
export const SMB_PORT = 445;

export interface SonosSmbConfig {
  shareName: string;
  username: string;
  password: string;
}

export const DEFAULT_CONFIG: SonosSmbConfig = {
  shareName: "Music",
  username: "",
  password: "",
};

export async function loadConfiguration(
  database: Db,
  category: string,
  pluginId: string,
): Promise<SonosSmbConfig> {
  const pluginConfig: PluginConfigDBModel | undefined =
    await PluginConfigDBModel.findByPluginId(database, category, pluginId);

  if (!pluginConfig) {
    return { ...DEFAULT_CONFIG };
  }

  const shareName = loadShareName(pluginConfig);
  const username = loadUsername(pluginConfig);
  const password = loadPassword(pluginConfig);

  return {
    shareName,
    username,
    password,
  };
}

export function getConfiguration(
  config: SonosSmbConfig,
): PluginConfigurationSettings {
  return {
    variables: [
      { [SHARE_NAME_KEY]: "string" },
      { [USERNAME_KEY]: "string" },
      { [PASSWORD_KEY]: "password" },
    ],
    labels: {
      [SHARE_NAME_KEY]: LABEL_SHARE_NAME,
      [USERNAME_KEY]: LABEL_USERNAME,
      [PASSWORD_KEY]: LABEL_PASSWORD,
    },
    values: {
      [SHARE_NAME_KEY]: config.shareName,
      [USERNAME_KEY]: config.username,
      [PASSWORD_KEY]: config.password,
    },
  };
}

export async function updateConfiguration(
  database: Db,
  category: string,
  pluginId: string,
  settings: PluginConfigurationValues,
): Promise<SonosSmbConfig> {
  const shareName = settings[SHARE_NAME_KEY];
  validateShareName(shareName);

  const username = settings[USERNAME_KEY];
  validateUsername(username);

  const password = settings[PASSWORD_KEY];
  validatePassword(password);

  await PluginConfigDBModel.upsertSettings(database, category, pluginId, {
    [SHARE_NAME_KEY]: shareName,
    [USERNAME_KEY]: username,
    [PASSWORD_KEY]: password,
  });

  return { shareName, username, password };
}

function validateShareName(
  shareName: unknown,
): asserts shareName is string {
  if (typeof shareName !== "string" || shareName.trim() === "") {
    throw new Error(`${LABEL_SHARE_NAME} must be a non-empty string`);
  }
}

function validateUsername(username: unknown): asserts username is string {
  if (typeof username !== "string" || username.trim() === "") {
    throw new Error(`${LABEL_USERNAME} must be a non-empty string`);
  }
}

function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password === "") {
    throw new Error(`${LABEL_PASSWORD} must be a non-empty string`);
  }
}

function loadShareName(pluginConfig: PluginConfigDBModel): string {
  const shareName = pluginConfig.settings[SHARE_NAME_KEY];
  return shareName !== undefined
    ? (shareName as string)
    : DEFAULT_CONFIG.shareName;
}

function loadUsername(pluginConfig: PluginConfigDBModel): string {
  const username = pluginConfig.settings[USERNAME_KEY];
  return username !== undefined ? (username as string) : DEFAULT_CONFIG.username;
}

function loadPassword(pluginConfig: PluginConfigDBModel): string {
  const password = pluginConfig.settings[PASSWORD_KEY];
  return password !== undefined ? (password as string) : DEFAULT_CONFIG.password;
}
