/**
 * IESDP Opcode File Generator
 *
 * Parses IESDP opcode HTML files with YAML frontmatter and generates
 * the opcode.tph WeiDU constant definitions file.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { readFile, validateDirectory, log } from "./utils.js";
import { IESDP_BASE_URL } from "./iesdp-url.js";
import { htmlToMarkdown } from "./iesdp-html-to-markdown.js";

// Constants
export const SKIP_OPCODE_NAMES = ["empty", "crash", "unknown"];

export const OPCODE_NAME_REPLACEMENTS: Readonly<Record<string, string>> = {
  " ": "_",
  ")": "_",
  "(": "_",
  ":": "",
  "-": "_",
  ",": "",
  "&": "",
  ".": "",
  "'": "",
  "/": "_",
  modifier: "mod",
  resistance: "resist",
  removal_remove: "remove",
  high_level_ability: "HLA",
};

/**
 * Opcode 175 shares the normalized name "hold" with opcode 109.
 * The collision resolver would name it "hold_2", but the canonical name is "hold_graphic".
 */
export const HOLD_GRAPHIC_OPCODE = 175;

export const OPCODE_PREFIX_STRIP: readonly string[] = [
  "item_",
  "graphics_",
  "spell_effect_", // must be before spell_
  "spell_",
  "stat_",
  "state_",
  "summon_",
];

// Types
export interface OpcodeEntry {
  num: number;
  opname: string;
  body: string;
}

export interface OpcodeFrontmatter {
  n: number;
  opname: string;
  bg2: number;
  [key: string]: unknown;
}

/**
 * Recursively finds all files with the given extension in a directory.
 */
function findFiles(dirPath: string, ext: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (entry.name.toLowerCase().endsWith(ext.toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Normalizes an opcode name for use as a WeiDU constant.
 */
export function normalizeOpcodeName(name: string): string {
  let result = name.toLowerCase();

  // Apply replacements
  for (const [from, to] of Object.entries(OPCODE_NAME_REPLACEMENTS)) {
    result = result.replaceAll(from, to);
  }

  // Collapse multiple underscores and strip leading/trailing
  result = result.replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");

  // Strip known prefixes
  for (const prefix of OPCODE_PREFIX_STRIP) {
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
      break;
    }
  }

  return result;
}

/**
 * Validates that parsed frontmatter has the required opcode fields.
 */
function isOpcodeFrontmatter(data: Record<string, unknown>): data is OpcodeFrontmatter {
  return typeof data.n === "number" && typeof data.opname === "string" && typeof data.bg2 === "number";
}

/**
 * Parses an opcode HTML file with YAML frontmatter.
 * Returns null and logs a warning if the file has invalid/missing frontmatter fields.
 */
export function parseOpcodeFrontmatter(filePath: string): { frontmatter: OpcodeFrontmatter; body: string } | null {
  const content = readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data;

  if (!isOpcodeFrontmatter(data)) {
    log(`Warning: Skipping ${filePath}: missing required frontmatter fields (n, opname, bg2)`);
    return null;
  }

  return { frontmatter: data, body: parsed.content };
}

/**
 * Formats a single opcode entry as a JSDoc comment + OUTER_SET line.
 */
function formatOpcodeJsDoc(name: string, entry: OpcodeEntry): string {
  const url = `${IESDP_BASE_URL}/opcodes/bgee.htm#op${entry.num}`;
  const bodyMarkdown = htmlToMarkdown(entry.body, "opcode").trim();
  // Collapse runs of blank lines into a single blank line
  const descLines = bodyMarkdown
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => ` * ${line}`.trimEnd());
  return [
    "/**",
    ` * [${entry.opname}](${url})`,
    " *",
    ...descLines,
    " */",
    `OUTER_SET OPCODE_${name} = ${entry.num}`,
  ].join("\n");
}

/**
 * Generates the opcode.tph file from IESDP opcode definitions.
 */
export function generateOpcodeFile(iesdpDir: string, outputFile: string): void {
  const opcodeDir = path.join(iesdpDir, "_opcodes");
  validateDirectory(opcodeDir, "Opcode directory");

  const files = findFiles(opcodeDir, ".html");
  const parsed = files
    .map(parseOpcodeFrontmatter)
    .filter((r): r is NonNullable<typeof r> => r !== null && r.frontmatter.bg2 === 1);

  // Sort by opcode number
  parsed.sort((a, b) => a.frontmatter.n - b.frontmatter.n);

  // Build unique opcode map (some names collide, need to make unique)
  const opcodesUnique = new Map<string, OpcodeEntry>();
  for (const { frontmatter: o, body } of parsed) {
    let name = normalizeOpcodeName(o.opname);

    if (SKIP_OPCODE_NAMES.includes(name)) {
      continue;
    }

    // Check for name collisions -- loop to handle multiple collisions
    let uniqueName = name;
    let suffix = 2;
    while (opcodesUnique.has(uniqueName)) {
      uniqueName = `${name}_${suffix++}`;
    }
    name = uniqueName;

    if (o.n === HOLD_GRAPHIC_OPCODE) {
      name = "hold_graphic";
    }

    opcodesUnique.set(name, { num: o.n, opname: o.opname, body });
  }

  // Generate output with full JSDoc from opcode HTML body
  const lines = [...opcodesUnique.entries()].map(
    ([name, entry]) => formatOpcodeJsDoc(name, entry),
  );

  // Separate entries with blank lines for readability
  fs.writeFileSync(outputFile, lines.join("\n\n") + "\n");
  log(`Generated ${outputFile} with ${opcodesUnique.size} opcodes`);
}
