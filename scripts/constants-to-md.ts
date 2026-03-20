#!/usr/bin/env tsx

/**
 * Constants to Markdown Converter
 *
 * Parses OUTER_SET / OUTER_SPRINT constants from WeiDU .tph files and generates
 * Markdown table pages for VitePress documentation.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as yaml from "js-yaml";
import { readFile, log } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConstantSection {
  readonly name: string;
  readonly title: string;
  readonly desc: string;
  readonly files: readonly string[];
}

interface ParsedConstant {
  readonly name: string;
  readonly value: string;
  readonly description: string;
  readonly sourceFile: string;
}

/**
 * Extracts the JSDoc description from a block comment preceding a constant.
 * Returns the first line of the description (after the @type tag line, if any).
 */
function extractJsDocDescription(block: string): string {
  const lines = block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l.length > 0);

  // Skip @type line, take the rest as description
  const descLines: string[] = [];
  let pastType = false;
  for (const line of lines) {
    if (line.startsWith("@type")) {
      pastType = true;
      continue;
    }
    if (!pastType && lines.some((l) => l.startsWith("@type"))) {
      continue;
    }
    descLines.push(line);
  }

  if (descLines.length === 0) {
    return "";
  }

  // Return first meaningful line only (keep it concise for the table)
  return descLines[0] ?? "";
}

/**
 * Extracts the @type value from a JSDoc block (e.g. "resref", "char offset").
 */
function extractJsDocType(block: string): string {
  const match = block.match(/@type\s+\{([^}]+)\}/);
  return match?.[1] ?? "";
}

/**
 * Parses a single .tph file and returns an array of constants found in it.
 */
function parseConstantsFile(filePath: string): readonly ParsedConstant[] {
  const content = readFile(filePath);
  const lines = content.split("\n");
  const constants: ParsedConstant[] = [];
  const sourceFile = path.relative(
    path.resolve(__dirname, ".."),
    filePath,
  );

  let currentJsDoc = "";
  let inJsDoc = false;
  let jsDocBuffer = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Track JSDoc blocks
    if (trimmed.startsWith("/**")) {
      inJsDoc = true;
      jsDocBuffer = trimmed;
      if (trimmed.endsWith("*/")) {
        inJsDoc = false;
        currentJsDoc = jsDocBuffer;
      }
      continue;
    }
    if (inJsDoc) {
      jsDocBuffer += "\n" + trimmed;
      if (trimmed.endsWith("*/")) {
        inJsDoc = false;
        currentJsDoc = jsDocBuffer;
      }
      continue;
    }

    // Match OUTER_SET name = value
    const setMatch = trimmed.match(
      /^OUTER_SET\s+(\w+)\s*=\s*(.+)$/,
    );
    if (setMatch) {
      const name = setMatch[1]!;
      const value = setMatch[2]!.trim();
      const description = currentJsDoc
        ? extractJsDocDescription(currentJsDoc)
        : "";
      constants.push({ name, value, description, sourceFile });
      currentJsDoc = "";
      continue;
    }

    // Match OUTER_SPRINT ~name~ ~value~ or OUTER_SPRINT name ~value~
    const sprintMatch = trimmed.match(
      /^OUTER_SPRINT\s+~?(\w+)~?\s+~([^~]*)~/,
    );
    if (sprintMatch) {
      const name = sprintMatch[1]!;
      const value = sprintMatch[2]!;
      const type = currentJsDoc
        ? extractJsDocType(currentJsDoc)
        : "";
      const description = type || "";
      constants.push({ name, value, description, sourceFile });
      currentJsDoc = "";
      continue;
    }

    // Non-constant, non-comment, non-blank line resets JSDoc
    if (trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("INCLUDE")) {
      currentJsDoc = "";
    }
  }

  return constants;
}

/**
 * Title-cases a snake_case string (e.g. "container_flags" -> "Container Flags").
 */
function prettify(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Builds a heading lookup for a section's files.
 * Prefixes with the parent directory for files nested 2+ dirs deep
 * (e.g. "structures/are/flags.tph" -> "ARE / Flags") since the parent
 * provides meaningful context. Shallow files ("misc/icons.tph") use
 * just the basename since the parent is already the page category.
 */
function buildHeadings(files: readonly string[]): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const file of files) {
    const base = path.basename(file, ".tph");
    const parts = file.split("/");
    // 3+ parts means nested subdirectory (e.g. structures/are/flags.tph)
    const isDeep = parts.length >= 3;

    if (isDeep) {
      // Parent is the structure type directory (are, cre, itm, etc.)
      const dir = parts[parts.length - 2]!;
      const dirLabel = dir.toUpperCase();
      result.set(file, base === "main" ? dirLabel : `${dirLabel} / ${prettify(base)}`);
    } else {
      result.set(file, prettify(base));
    }
  }

  return result;
}

/**
 * Escapes pipe characters for use in markdown table cells.
 */
function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

/**
 * Renders a group of constants as a markdown table.
 */
function renderConstantsTable(constants: readonly ParsedConstant[]): string {
  const hasDescriptions = constants.some((c) => c.description.length > 0);

  const lines: string[] = [];

  if (hasDescriptions) {
    lines.push("| Name | Value | Description |");
    lines.push("|---|---|---|");
    for (const c of constants) {
      lines.push(
        `| \`${c.name}\` | \`${escapeCell(c.value)}\` | ${escapeCell(c.description)} |`,
      );
    }
  } else {
    lines.push("| Name | Value |");
    lines.push("|---|---|");
    for (const c of constants) {
      lines.push(`| \`${c.name}\` | \`${escapeCell(c.value)}\` |`);
    }
  }

  return lines.join("\n");
}

/**
 * Renders a full constants section page as markdown.
 */
function renderSectionPage(
  section: ConstantSection,
  fileGroups: ReadonlyMap<string, readonly ParsedConstant[]>,
): string {
  const headings = buildHeadings(section.files);

  const lines: string[] = [
    "---",
    `title: ${section.title}`,
    `description: ${section.desc}`,
    "---",
    "",
    `# ${section.title}`,
    "",
    section.desc,
    "",
  ];

  for (const file of section.files) {
    const constants = fileGroups.get(file);
    if (!constants || constants.length === 0) {
      continue;
    }

    lines.push(`## ${headings.get(file) ?? prettify(path.basename(file, ".tph"))}`);
    lines.push("");
    lines.push(`Source: \`${file}\``);
    lines.push("");
    lines.push(renderConstantsTable(constants));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Parses constants.yml to get section metadata.
 */
function parseSectionsYml(content: string): readonly ConstantSection[] {
  const parsed = yaml.load(content);
  if (!Array.isArray(parsed)) {
    throw new Error("constants.yml must be an array");
  }
  return parsed.map((item: unknown, index: number) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid entry at index ${index}`);
    }
    const obj = item as Record<string, unknown>;
    if (
      typeof obj.name !== "string" ||
      typeof obj.title !== "string" ||
      !Array.isArray(obj.files)
    ) {
      throw new Error(
        `Entry at index ${index} must have 'name', 'title', and 'files'`,
      );
    }
    const desc = typeof obj.desc === "string" ? obj.desc : "";
    const files = obj.files.map((f: unknown) => {
      if (typeof f !== "string") {
        throw new Error(`Invalid file path in section '${obj.name}'`);
      }
      return f;
    });
    return { name: obj.name, title: obj.title, desc, files };
  });
}

function main(): void {
  const projectRoot = path.resolve(__dirname, "..");
  const docsDir = path.join(projectRoot, "docs");
  const outputDir = path.join(docsDir, "constants");
  fs.mkdirSync(outputDir, { recursive: true });

  const sectionsPath = path.join(docsDir, "_data", "constants.yml");
  const sectionsContent = readFile(sectionsPath);
  const sections = parseSectionsYml(sectionsContent);

  log(`Processing constant sections: ${sections.map((s) => s.name).join(", ")}`);

  let totalConstants = 0;

  for (const section of sections) {
    const fileGroups = new Map<string, readonly ParsedConstant[]>();
    const seen = new Set<string>();

    for (const file of section.files) {
      if (seen.has(file)) {
        continue;
      }
      seen.add(file);

      const fullPath = path.join(projectRoot, file);
      if (!fs.existsSync(fullPath)) {
        log(`  Skipping ${file}: not found`);
        continue;
      }

      const constants = parseConstantsFile(fullPath);
      if (constants.length > 0) {
        fileGroups.set(file, constants);
        totalConstants += constants.length;
      }
    }

    const mdContent = renderSectionPage(section, fileGroups);
    const mdPath = path.join(outputDir, `${section.name}.md`);
    fs.writeFileSync(mdPath, mdContent);
    log(`  Generated ${section.name}.md (${[...fileGroups.values()].reduce((n, g) => n + g.length, 0)} constants)`);
  }

  log(`Done! ${totalConstants} constants total.`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
