#!/usr/bin/env tsx

/**
 * JSDoc to Markdown Converter
 *
 * Parses JSDoc comments from WeiDU .tph files and generates Markdown files
 * for VitePress documentation.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as yaml from "js-yaml";
import { parseWeiduJsDoc, type WeiduFunction, type JsDocParam } from "./weidu-jsdoc-parser.js";
import { readFile, log } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWN_TYPES = new Set([
  "array",
  "bool",
  "ids",
  "int",
  "list",
  "map",
  "resref",
  "filename",
  "string",
]);

interface SectionInfo {
  name: string;
  title: string;
  desc: string;
}

interface TypeInfo {
  name: string;
  desc: string;
}

/**
 * Renders a type name as a markdown link if it's a known type.
 */
export function typeLink(type: string): string {
  if (KNOWN_TYPES.has(type)) {
    return `[${type}](/types#${type})`;
  }
  return type;
}

/**
 * Cleans WeiDU string delimiters from a default value.
 */
export function cleanDefault(value: string): string {
  let cleaned = value;

  if (cleaned.startsWith("~") && cleaned.endsWith("~")) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned;
}

/**
 * Formats a parameter's default value for display.
 */
export function formatDefault(param: { type: string; required: boolean; default?: string }): string {
  if (param.required) {
    return '<span class="required">required</span>';
  }

  if (param.default === undefined) {
    return "";
  }

  const cleaned = cleanDefault(param.default);

  if (cleaned === "" || cleaned === "-1") {
    return "";
  }

  if (param.type === "bool") {
    if (cleaned === "1") return "True";
    if (cleaned === "0") return "False";
  }

  return cleaned;
}

/**
 * Escapes pipe characters in a string for use inside markdown table cells.
 */
function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

/**
 * Renders a parameters table for a given var type (INT_VAR or STR_VAR).
 */
export function renderParamsTable(
  label: string,
  params: readonly JsDocParam[],
): string[] {
  const sorted = [...params].toSorted((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [
    `| **${label}** | **Description** | **Type** | **Default** |`,
    "|---|---|---|---|",
  ];

  for (const p of sorted) {
    const defaultVal = formatDefault(p);
    const desc = escapeTableCell(p.description);
    lines.push(`| ${p.name} | ${desc} | ${typeLink(p.type)} | ${defaultVal} |`);
  }

  return lines;
}

/**
 * Renders a returns table.
 */
export function renderReturnsTable(
  returns: readonly { name: string; type: string; description: string }[],
): string[] {
  const sorted = [...returns].toSorted((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [
    "| **Return** | **Description** | **Type** |",
    "|---|---|---|",
  ];

  for (const r of sorted) {
    const desc = escapeTableCell(r.description);
    lines.push(`| ${r.name} | ${desc} | ${typeLink(r.type)} |`);
  }

  return lines;
}

/**
 * Renders a single function as markdown.
 */
export function renderFunction(func: WeiduFunction): string {
  const lines: string[] = [];
  const badgeType = func.type === "patch" ? "tip" : "info";

  lines.push(`## ${func.name} <Badge type="${badgeType}" text="${func.type}" />`);
  lines.push("");
  lines.push(func.description);
  lines.push("");

  const intParams = func.params.filter((p) => p.varType === "INT_VAR");
  const strParams = func.params.filter((p) => p.varType === "STR_VAR");

  if (intParams.length > 0) {
    lines.push(...renderParamsTable("INT_VAR", intParams));
    lines.push("");
  }

  if (strParams.length > 0) {
    lines.push(...renderParamsTable("STR_VAR", strParams));
    lines.push("");
  }

  if (func.returns.length > 0) {
    lines.push(...renderReturnsTable(func.returns));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Renders a full section page as markdown.
 */
export function renderSectionPage(section: SectionInfo, functions: readonly WeiduFunction[]): string {
  const sorted = [...functions].toSorted((a, b) => a.name.localeCompare(b.name));

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

  for (const func of sorted) {
    lines.push(renderFunction(func));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Renders the types page as markdown.
 */
export function renderTypesPage(types: readonly TypeInfo[]): string {
  const lines: string[] = [
    "---",
    "title: Types",
    "---",
    "",
    "# Types",
    "",
    "Description of parameter types used in functions and macros.",
    "",
  ];

  for (const type of types) {
    lines.push(`## ${type.name}`);
    lines.push("");
    lines.push(type.desc);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Parses sections.yml to get section metadata.
 */
function parseSections(content: string): SectionInfo[] {
  const parsed = yaml.load(content);
  if (!Array.isArray(parsed)) {
    throw new Error("sections.yml must be an array");
  }
  return parsed.map((item: unknown, index: number) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid section entry at index ${index} in sections.yml`);
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.title !== "string") {
      throw new Error(`Section at index ${index} must have 'name' and 'title' string fields`);
    }
    const desc = typeof obj.desc === "string" ? obj.desc : "";
    return { name: obj.name, title: obj.title, desc };
  });
}

/**
 * Parses types.yml to get type definitions.
 */
function parseTypes(content: string): TypeInfo[] {
  const parsed = yaml.load(content);
  if (!Array.isArray(parsed)) {
    throw new Error("types.yml must be an array");
  }
  return parsed.map((item: unknown, index: number) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid type entry at index ${index} in types.yml`);
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.desc !== "string") {
      throw new Error(`Type at index ${index} must have 'name' and 'desc' string fields`);
    }
    return { name: obj.name, desc: obj.desc };
  });
}

/**
 * Processes all .tph files and generates Markdown documentation.
 */
function main(): void {
  const projectRoot = path.resolve(__dirname, "..");
  const functionsDir = path.join(projectRoot, "functions");
  const docsDir = path.join(projectRoot, "docs");
  const outputDir = path.join(docsDir, "functions");
  fs.mkdirSync(outputDir, { recursive: true });

  // Read sections.yml
  const sectionsPath = path.join(docsDir, "_data", "sections.yml");
  const sectionsContent = readFile(sectionsPath);
  const sections = parseSections(sectionsContent);

  log(`Processing sections: ${sections.map((s) => s.name).join(", ")}`);

  let processedCount = 0;

  for (const section of sections) {
    const tphPath = path.join(functionsDir, `${section.name}.tph`);
    const mdPath = path.join(outputDir, `${section.name}.md`);

    if (!fs.existsSync(tphPath)) {
      log(`  Skipping ${section.name}: ${tphPath} not found`);
      continue;
    }

    log(`  Processing ${section.name}.tph...`);

    const content = readFile(tphPath);
    const functions = parseWeiduJsDoc(content);

    if (functions.length === 0) {
      log(`    No documented functions found in ${section.name}.tph`);
      continue;
    }

    const mdContent = renderSectionPage(section, functions);
    fs.writeFileSync(mdPath, mdContent);
    log(`    Generated ${mdPath} with ${functions.length} functions`);

    processedCount++;
  }

  // Generate types page
  const typesPath = path.join(docsDir, "_data", "types.yml");
  const typesContent = readFile(typesPath);
  const types = parseTypes(typesContent);
  const typesPage = renderTypesPage(types);
  fs.writeFileSync(path.join(docsDir, "types.md"), typesPage);
  log(`Generated types.md with ${types.length} types`);

  log(`Done! Processed ${processedCount} sections.`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
