/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export type ConfigType = "string" | "boolean";

export type ConfigValue = string | boolean;

export interface ConfigParamDefinition {
  key: string;
  label: string;
  type: ConfigType;
  defaultValue: ConfigValue;
  // Returns an error message if the value is invalid, or null if valid.
  validate: (value: unknown) => string | null;
}

// Seeded with two generic test parameters (issue #101): one string, one
// boolean, to exercise both UI widgets and the validation/error path. Real
// parameters are added by extending this array. Stored values are not yet
// consumed by the running server — startup wiring is a separate future issue.
export const CONFIG_REGISTRY: ConfigParamDefinition[] = [
  {
    key: "test.string",
    label: "Test String",
    type: "string",
    defaultValue: "",
    validate: (value: unknown): string | null => {
      if (typeof value !== "string") {
        return "Test String must be a string";
      }
      if (value.trim().length === 0) {
        return "Test String must not be empty";
      }
      return null;
    },
  },
  {
    key: "test.boolean",
    label: "Test Boolean",
    type: "boolean",
    defaultValue: false,
    validate: (value: unknown): string | null => {
      if (typeof value !== "boolean") {
        return "Test Boolean must be a boolean";
      }
      return null;
    },
  },
];

export function getAllDefinitions(): ConfigParamDefinition[] {
  return CONFIG_REGISTRY;
}

export function getDefinition(
  key: string,
): ConfigParamDefinition | undefined {
  return CONFIG_REGISTRY.find((d) => d.key === key);
}
