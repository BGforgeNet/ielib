/**
 * IESDP Item Types Generator
 *
 * Generates structures/item_types.tph from IESDP item_types.yml data.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { readFile, log, applyIdReplacements } from "./utils.js";
import { stripAllMarkup } from "./iesdp-html-to-markdown.js";
import { ValidationError } from "./iesdp-structure.js";

// Types
export interface ItemTypeRaw {
  code: string;
  type: string;
  id?: string;
}

// Constants
export const ITEM_TYPE_PREFIX = "ITEM_TYPE_";

/**
 * Validates that parsed YAML is an array of item type entries.
 */
function isItemTypeArray(data: unknown): data is ItemTypeRaw[] {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }
  const first: unknown = data[0];
  return typeof first === "object" && first !== null && "code" in first && "type" in first;
}

/**
 * Generates an ID for an item type entry.
 * Uses custom 'id' field if present, otherwise derives from description.
 */
export function getItemTypeId(item: ItemTypeRaw): string {
  if (item.id !== undefined) {
    return ITEM_TYPE_PREFIX + item.id;
  }

  const id = ITEM_TYPE_PREFIX + applyIdReplacements(stripAllMarkup(item.type.toLowerCase()));

  if (!/^[a-zA-Z0-9_]+$/.test(id)) {
    throw new ValidationError(`Invalid item type id generated: "${id}" from type: "${item.type}"`);
  }

  return id;
}

/**
 * Generates structures/item_types.tph from IESDP item_types.yml.
 */
export function generateItemTypesFile(itemTypesPath: string, structuresDir: string): void {
  log(`loading ${itemTypesPath}`);
  const content = readFile(itemTypesPath);
  const parsed = yaml.load(content);

  if (!isItemTypeArray(parsed)) {
    throw new ValidationError(`Invalid item types data in ${itemTypesPath}`);
  }

  const lines: string[] = [];
  for (const item of parsed) {
    if (item.type.toLowerCase() === "unknown") {
      continue;
    }

    const code = parseInt(item.code, 16);
    if (Number.isNaN(code)) {
      throw new ValidationError(`Invalid item type code '${item.code}' for '${item.type}' in ${itemTypesPath}`);
    }

    const id = getItemTypeId(item);
    lines.push(`OUTER_SET ${id} = 0x${code.toString(16).padStart(2, "0")}`);
  }

  const outputFile = path.join(structuresDir, "item_types.tph");
  fs.writeFileSync(outputFile, lines.join("\n") + "\n");
  log(`Generated ${outputFile}`);
}
