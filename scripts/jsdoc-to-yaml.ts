#!/usr/bin/env tsx

/**
 * JSDoc to YAML Converter
 *
 * Parses JSDoc comments from WeiDU .tph files and generates YAML files
 * for Jekyll documentation generation.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as yaml from "js-yaml";
import { parseWeiduJsDoc, WeiduFunction, JsDocParam } from "./weidu-jsdoc-parser.js";
import { readFile, log } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Offset added to section index for nav_order in generated pages.
 * Accounts for fixed pages (home, about, etc.) that precede sections.
 */
const NAV_ORDER_OFFSET = 3;

// Types
interface YamlParam {
  name: string;
  desc: string;
  type: string;
  required?: number;
  default?: string;
}

interface YamlReturn {
  name: string;
  type: string;
  desc: string;
}

interface YamlFunction {
  name: string;
  desc: string;
  type: string;
  int_params?: YamlParam[];
  string_params?: YamlParam[];
  return?: YamlReturn[];
}

/**
 * Converts a WeiduFunction to YAML-compatible format.
 */
export function functionToYaml(func: WeiduFunction): YamlFunction {
  const result: YamlFunction = {
    name: func.name,
    desc: func.description,
    type: func.type,
  };

  const intParams = func.params.filter((p) => p.varType === "INT_VAR");
  const strParams = func.params.filter((p) => p.varType === "STR_VAR");

  if (intParams.length > 0) {
    result.int_params = intParams.map(paramToYaml);
  }

  if (strParams.length > 0) {
    result.string_params = strParams.map(paramToYaml);
  }

  if (func.returns.length > 0) {
    result.return = func.returns.map((ret) => ({
      name: ret.name,
      type: ret.type,
      desc: ret.description,
    }));
  }

  return result;
}

/**
 * Converts a JsDocParam to YAML param format.
 */
export function paramToYaml(param: JsDocParam): YamlParam {
  const result: YamlParam = {
    name: param.name,
    desc: param.description,
    type: param.type,
  };

  if (param.required) {
    result.required = 1;
  } else if (param.default !== undefined) {
    // Clean up the default value - remove WeiDU string delimiters
    let defaultValue = param.default;

    // Remove ~ delimiters
    if (defaultValue.startsWith("~") && defaultValue.endsWith("~")) {
      defaultValue = defaultValue.slice(1, -1);
    }

    // Remove " delimiters
    if (defaultValue.startsWith('"') && defaultValue.endsWith('"')) {
      defaultValue = defaultValue.slice(1, -1);
    }

    // Skip empty defaults and sentinel values
    if (defaultValue !== "" && defaultValue !== "-1") {
      result.default = defaultValue;
    }
  }

  return result;
}

/**
 * Pattern matching YAML values that need quoting: values starting with
 * special indicators, or containing sequences that could be misinterpreted.
 */
const YAML_NEEDS_QUOTING = /^[#[{}&*!|>'"%@`\]]|: | #/;

/**
 * Escapes a scalar value for safe inline YAML emission.
 * Quotes with double-quotes when the value contains YAML-significant characters.
 */
function yamlScalar(value: string): string {
  if (YAML_NEEDS_QUOTING.test(value) || value.includes(": ") || value.includes(" #")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Serializes a list of params into YAML lines.
 * Returns a new array of lines (pure function, no mutation).
 */
function serializeParams(label: string, params: readonly YamlParam[]): string[] {
  const lines: string[] = [`  ${label}:`];
  for (const param of params) {
    lines.push(`    - name: ${param.name}`);
    lines.push(`      desc: ${yamlScalar(param.desc)}`);
    lines.push(`      type: ${param.type}`);
    if (param.required !== undefined) {
      lines.push(`      required: ${param.required}`);
    }
    if (param.default !== undefined) {
      lines.push(`      default: ${yamlScalar(param.default)}`);
    }
  }
  return lines;
}

/**
 * Serializes YAML manually to match the original format exactly.
 */
export function serializeYaml(functions: readonly YamlFunction[]): string {
  // Sort functions alphabetically by name
  const sorted = [...functions].toSorted((a, b) => a.name.localeCompare(b.name));

  const lines = sorted.flatMap((func) => {
    const funcLines: string[] = [`- name: ${func.name}`];

    // Handle multi-line descriptions with YAML block scalar
    if (func.desc.includes("\n")) {
      funcLines.push("  desc: |");
      for (const line of func.desc.split("\n")) {
        funcLines.push(`    ${line}`);
      }
    } else {
      funcLines.push(`  desc: ${yamlScalar(func.desc)}`);
    }

    funcLines.push(`  type: ${func.type}`);

    if (func.int_params) {
      funcLines.push(...serializeParams("int_params", func.int_params));
    }

    if (func.string_params) {
      funcLines.push(...serializeParams("string_params", func.string_params));
    }

    if (func.return) {
      funcLines.push("  return:");
      for (const ret of func.return) {
        funcLines.push(`    - name: ${ret.name}`);
        funcLines.push(`      desc: ${yamlScalar(ret.desc)}`);
        funcLines.push(`      type: ${ret.type}`);
      }
    }

    funcLines.push("");
    return funcLines;
  });

  return lines.join("\n");
}

interface SectionInfo {
  name: string;
  title: string;
  desc: string;
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
    return {
      name: obj.name,
      title: obj.title,
      desc,
    };
  });
}

/**
 * Generates a markdown page for a section.
 */
function generateSectionPage(section: SectionInfo, navOrder: number): string {
  return `---
title: ${section.title}
layout: functions
section: ${section.name}
nav_order: ${navOrder + NAV_ORDER_OFFSET}
permalink: /${section.name}/
description: ${section.desc}
---
`;
}

/**
 * Processes all .tph files and generates YAML documentation and pages.
 */
function main(): void {
  const projectRoot = path.resolve(__dirname, "..");
  const functionsDir = path.join(projectRoot, "functions");
  const dataOutputDir = path.join(projectRoot, "docs", "_data", "functions");
  const pagesOutputDir = path.join(projectRoot, "docs", "_pages");
  fs.mkdirSync(dataOutputDir, { recursive: true });
  fs.mkdirSync(pagesOutputDir, { recursive: true });

  // Read sections.yml to get the list of expected files
  const sectionsPath = path.join(projectRoot, "docs", "_data", "sections.yml");
  const sectionsContent = readFile(sectionsPath);
  const sections = parseSections(sectionsContent);

  log(`Processing sections: ${sections.map((s) => s.name).join(", ")}`);

  let processedCount = 0;

  for (const [i, section] of sections.entries()) {
    const tpaPath = path.join(functionsDir, `${section.name}.tph`);
    const yamlPath = path.join(dataOutputDir, `${section.name}.yml`);
    const pagePath = path.join(pagesOutputDir, `${section.name}.md`);

    if (!fs.existsSync(tpaPath)) {
      log(`  Skipping ${section.name}: ${tpaPath} not found`);
      continue;
    }

    log(`  Processing ${section.name}.tph...`);

    const content = readFile(tpaPath);
    const functions = parseWeiduJsDoc(content);

    if (functions.length === 0) {
      log(`    No documented functions found in ${section.name}.tph`);
      continue;
    }

    const yamlFunctions = functions.map(functionToYaml);
    const yamlContent = serializeYaml(yamlFunctions);

    fs.writeFileSync(yamlPath, yamlContent);
    log(`    Generated ${yamlPath} with ${functions.length} functions`);

    // Generate page
    const pageContent = generateSectionPage(section, i + 1);
    fs.writeFileSync(pagePath, pageContent);
    log(`    Generated ${pagePath}`);

    processedCount++;
  }

  log(`Done! Processed ${processedCount} sections.`);
}

// Run main when executed directly
try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
