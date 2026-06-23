/*
 * Created on Tue Jun 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { listFiles } from "./fsUtils.js";

export interface WizardStep {
  image: string;
  text: string;
}

export interface WizardDefinition {
  id: string;
  steps: WizardStep[];
}

export function getWizardsFolder(): string {
  return path.resolve(process.cwd(), "wizards");
}

export function getWizardImagesFolder(): string {
  return path.resolve(process.cwd(), "wizards", "images");
}

/**
 * Lists the wizard definition files in deterministic order. The numeric
 * filename prefix (e.g. 0001-welcome.json) drives the traversal order so
 * that older wizards are always served before newer ones.
 */
export async function listWizardFiles(): Promise<string[]> {
  const files = await listFiles(getWizardsFolder());
  return files
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Reads and parses a single wizard definition file. Returns undefined when
 * the file cannot be read, is not valid JSON, or does not match the expected
 * shape so that a single malformed file never breaks the feature.
 */
export async function loadWizard(
  filePath: string,
): Promise<WizardDefinition | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as WizardDefinition;
    if (typeof parsed?.id !== "string" || !Array.isArray(parsed.steps)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}
