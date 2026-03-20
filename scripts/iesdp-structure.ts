/**
 * IESDP Structure File Generator
 *
 * Processes IESDP YAML structure definitions and generates WeiDU
 * constant files with offset definitions for IE file formats.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { readFile, validateDirectory, log } from "./utils.js";
import { htmlToMarkdown, stripAllMarkup } from "./iesdp-html-to-markdown.js";

// Types
export interface StructureItem {
  offset?: number;
  desc: string;
  id?: string;
  type: string;
  length?: number;
  mult?: number;
  unused?: boolean;
  unknown?: boolean;
}

export interface StructureField {
  offset: number;
  type: string;
  desc: string;
}

/** Custom error class for validation errors. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Constants
export const TYPE_SIZE_MAP: Readonly<Record<string, number>> = {
  byte: 1,
  char: 1,
  word: 2,
  dword: 4,
  resref: 8,
  strref: 4,
};

export const KNOWN_TYPES: ReadonlySet<string> = new Set([
  "byte",
  "char",
  "word",
  "dword",
  "resref",
  "strref",
  "bytes",
  "char array",
  "byte array",
]);

export const STRUCTURE_PREFIX_MAP: Readonly<Record<string, string>> = {
  header: "",
  body: "",
  extended_header: "head",
};

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
 * Applies ID_REPLACEMENTS to a string.
 */
function applyIdReplacements(input: string): string {
  let result = input;
  for (const [from, to] of Object.entries(ID_REPLACEMENTS)) {
    result = result.replaceAll(from, to);
  }
  return result;
}

/**
 * Generates the prefix for a structure constant.
 * E.g., "eff_v2" + "body.yml" -> "EFF2_"
 */
export function getPrefix(fileVersion: string, dataFileName: string): string {
  const base = fileVersion.replace(/_v.*/, "");
  let version = fileVersion.replace(/.*_v/, "").replace(".", "");
  if (version === "1") {
    version = "";
  }

  const fbase = dataFileName.replace(".yml", "");
  const suffix = STRUCTURE_PREFIX_MAP[fbase] ?? fbase;

  let prefix = `${base}${version}_`;
  if (suffix !== "") {
    prefix = `${prefix}${suffix}_`;
  }

  return prefix.toUpperCase();
}

/**
 * Generates a constant ID from a structure item.
 */
export function generateId(item: StructureItem, prefix: string): string {
  // Use custom IElib id if provided
  if (item.id) {
    return prefix + item.id;
  }

  // Construct from description
  const iid = prefix + applyIdReplacements(stripAllMarkup(item.desc.toLowerCase()));

  // Validate: id must be alnum + '_' only
  if (!/^[a-zA-Z0-9_]+$/.test(iid)) {
    throw new ValidationError(`Invalid id generated: "${iid}" from desc: "${item.desc}"`);
  }

  return iid;
}

/**
 * Validates that a type is known.
 */
function validateType(type: string): string {
  if (!KNOWN_TYPES.has(type)) {
    throw new ValidationError(`Unknown type: "${type}"`);
  }
  return type;
}

/**
 * Computes the size of a structure field.
 */
export function getFieldSize(item: StructureItem): number {
  if (item.length !== undefined) {
    return item.length;
  }

  const size = TYPE_SIZE_MAP[item.type];
  if (size === undefined) {
    throw new ValidationError(`Unknown type: "${item.type}"`);
  }

  return item.mult !== undefined ? size * item.mult : size;
}

/**
 * Validates that parsed YAML is an array of structure items.
 */
function isStructureItemArray(data: unknown): data is StructureItem[] {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }
  const first: unknown = data[0];
  return typeof first === "object" && first !== null && "desc" in first && "type" in first;
}

/**
 * Loads a structure data file and computes offsets.
 */
export function loadDatafile(fpath: string, prefix: string, formatName: string): Map<string, StructureField> {
  log(`loading ${fpath}`);
  const content = readFile(fpath);
  const parsed = yaml.load(content);

  if (!isStructureItemArray(parsed)) {
    throw new ValidationError(`Invalid structure data in ${fpath}`);
  }

  const data = parsed;
  let curOff = data[0]?.offset ?? 0;
  const items = new Map<string, StructureField>();

  for (const item of data) {
    if (item.offset !== undefined && item.offset !== curOff) {
      log(`Warning: offset mismatch in ${fpath}. Expected ${curOff}, got ${item.offset}`);
    }

    const size = getFieldSize(item);

    // Skip unused/unknown fields
    if (item.unused || item.unknown) {
      curOff += size;
      continue;
    }

    const iid = generateId(item, prefix);
    items.set(iid, {
      offset: curOff,
      type: validateType(item.type),
      desc: htmlToMarkdown(item.desc, formatName),
    });
    curOff += size;
  }

  return items;
}

/**
 * Gets the output directory name for a format.
 * E.g., "eff_v1" -> "eff", "eff_v2" -> "eff2"
 */
function getOutputDirName(formatName: string): string {
  const base = formatName.replace(/_v.*/, "");
  const version = formatName.replace(/.*_v/, "");
  // For version 1, use just the base name; for v2+, append version number
  return version === "1" ? base : `${base}${version}`;
}

/**
 * Formats a structure entry as a multiline JSDoc comment + OUTER_SET line.
 */
function formatStructureEntry(id: string, field: StructureField): string {
  const descLines = field.desc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line !== "");

  const jsdocLines = [
    "/**",
    ` * @type ${field.type}`,
    ...descLines.map((line) => ` * ${line}`),
    " */",
  ];

  return `${jsdocLines.join("\n")}\nOUTER_SET ${id} = 0x${field.offset.toString(16)}`;
}

/**
 * Writes structure items to the appropriate output file.
 */
export function writeStructureFile(formatName: string, items: Map<string, StructureField>, structuresDir: string): void {
  const dirName = getOutputDirName(formatName);
  const outputDir = path.join(structuresDir, dirName);
  const outputFile = path.join(outputDir, "iesdp.tph");

  fs.mkdirSync(outputDir, { recursive: true });

  const lines = [...items.entries()].map(
    ([id, field]) => formatStructureEntry(id, field),
  );

  // Separate entries with blank lines for readability
  fs.writeFileSync(outputFile, lines.join("\n\n") + "\n");
  log(`Generated ${outputFile}`);
}

/**
 * Processes format directories and generates structure offset files.
 */
export function processFormatDirectories(fileFormatsDir: string, structuresDir: string): void {
  const formats = fs.readdirSync(fileFormatsDir);

  // Sort formats so higher versions come first, then v1 overwrites
  formats.sort((a, b) => b.localeCompare(a));

  for (const ff of formats) {
    const ffDir = path.join(fileFormatsDir, ff);
    if (!fs.statSync(ffDir).isDirectory()) {
      continue;
    }

    const items = new Map<string, StructureField>();
    const files = fs.readdirSync(ffDir).toSorted();

    for (const f of files) {
      // Feature blocks handled separately
      if (f === "feature_block.yml") {
        continue;
      }

      const prefix = getPrefix(ff, f);
      const fpath = path.join(ffDir, f);
      const newItems = loadDatafile(fpath, prefix, ff);

      for (const [k, v] of newItems) {
        items.set(k, v);
      }
    }

    writeStructureFile(ff, items, structuresDir);
  }
}

/**
 * Processes the feature block (output to fx/ directory).
 */
export function processFeatureBlock(fileFormatsDir: string, structuresDir: string): void {
  const featureBlockPath = path.join(fileFormatsDir, "itm_v1", "feature_block.yml");
  if (!fs.existsSync(featureBlockPath)) {
    return;
  }
  const fxItems = loadDatafile(featureBlockPath, "FX_", "fx_v1");
  writeStructureFile("fx_v1", fxItems, structuresDir);
}

/**
 * Processes all structure definitions from IESDP.
 */
export function processStructures(iesdpDir: string, structuresDir: string): void {
  const fileFormatsDir = path.join(iesdpDir, "_data", "file_formats");
  validateDirectory(fileFormatsDir, "File formats directory");

  processFormatDirectories(fileFormatsDir, structuresDir);
  processFeatureBlock(fileFormatsDir, structuresDir);
}
