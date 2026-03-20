/**
 * Shared utilities for build scripts.
 */

import * as fs from "fs";

/**
 * Reads a file and returns its content, throwing descriptive errors.
 */
export function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Validates that a directory exists.
 */
export function validateDirectory(dirPath: string, description: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${description} not found: ${dirPath}`);
  }
  if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`${description} is not a directory: ${dirPath}`);
  }
}

/** Logs a message to stdout. */
export function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Replacements applied when generating constant IDs from IESDP descriptions.
 * Order matters: longer prefixed replacements must come before shorter ones.
 */
export const ID_REPLACEMENTS: Readonly<Record<string, string>> = {
  "probability ": "probability",
  "usability ": "usability",
  "parameter ": "parameter",
  "resource ": "resource",
  alternative: "alt",
  ".": "",
  " ": "_",
};

/**
 * Applies ID_REPLACEMENTS to a string, producing a normalized constant ID fragment.
 */
export function applyIdReplacements(input: string): string {
  let result = input;
  for (const [from, to] of Object.entries(ID_REPLACEMENTS)) {
    result = result.replaceAll(from, to);
  }
  return result;
}
