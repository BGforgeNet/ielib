/**
 * IESDP HTML to Markdown Converter
 *
 * Converts HTML content from IESDP pages to markdown format.
 * Handles nested tags, tables, lists, links, and Jekyll liquid tags.
 * Resolves all URLs to absolute IESDP links.
 */

import { JSDOM } from "jsdom";
import { resolveIesdpUrl } from "./iesdp-url.js";

/**
 * Recursively walks a DOM node tree, converting HTML elements to markdown.
 * listDepth tracks nesting level for list indentation.
 */
export function walkNode(node: Node, formatName: string, listDepth: number = 0): string {
  // Text node: return content as-is (whitespace handled per-element)
  if (node.nodeType === node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  // Skip non-element nodes (comments, etc.)
  if (node.nodeType !== node.ELEMENT_NODE) {
    return "";
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case "a": {
      const children = walkChildren(el, formatName, listDepth);
      const href = el.getAttribute("href");
      if (href) {
        return `[${children}](${resolveIesdpUrl(href, formatName)})`;
      }
      // Named anchor: <a name="effv2_Body_0x14">text</a> -> link to that anchor
      const name = el.getAttribute("name");
      if (name) {
        return `[${children}](${resolveIesdpUrl(`#${name}`, formatName)})`;
      }
      return children;
    }
    case "code": {
      // When <code> wraps a single <a> link, emit [``text``](url) so the link renders.
      // Raw `[text](url)` inside backticks would not render as a clickable link.
      const anchor = el.querySelector("a[href]");
      if (anchor) {
        const linkText = walkChildren(anchor, formatName, listDepth);
        const href = anchor.getAttribute("href");
        if (href) {
          return `[\`${linkText}\`](${resolveIesdpUrl(href, formatName)})`;
        }
      }
      return `\`${walkChildren(el, formatName, listDepth)}\``;
    }
    case "b":
    case "strong":
      return `**${walkChildren(el, formatName, listDepth)}**`;
    case "br":
      return "\n";
    case "ul":
    case "ol":
      // Use collapsed walker to discard whitespace text nodes between <li> elements
      return walkChildrenCollapsed(el, formatName, listDepth + 1);
    case "li": {
      const indent = "  ".repeat(Math.max(0, listDepth - 1));
      const content = walkChildrenCollapsed(el, formatName, listDepth).trim();
      return `\n${indent}- ${content}`;
    }
    case "div":
    case "p": {
      const content = walkChildrenCollapsed(el, formatName, listDepth).trim();
      return `\n${content}`;
    }
    case "table":
      return "\n" + walkTable(el, formatName);
    // Skip table sub-elements handled by walkTable
    case "thead":
    case "tbody":
    case "tfoot":
    case "colgroup":
    case "col":
    case "tr":
    case "th":
    case "td":
      return walkChildren(el, formatName, listDepth);
    // Pass through content for unsupported tags (small, sup, sub, etc.)
    default:
      return walkChildren(el, formatName, listDepth);
  }
}

/**
 * Converts an HTML table to a markdown pipe table.
 * Extracts rows from thead/tbody, formats as | col1 | col2 | ... |
 */
function walkTable(table: Element, formatName: string): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) {
    return "";
  }

  const matrix = rows.map((row) =>
    Array.from(row.querySelectorAll("th, td")).map((cell) =>
      walkChildrenCollapsed(cell, formatName, 0).trim(),
    ),
  );

  // Determine column widths for alignment
  const colCount = Math.max(...matrix.map((r) => r.length));
  const widths = Array.from({ length: colCount }, (_, i) =>
    Math.max(3, ...matrix.map((r) => (r[i] ?? "").length)),
  );

  const formatRow = (cells: string[]): string => {
    const padded = widths.map((w, i) => (cells[i] ?? "").padEnd(w));
    return `| ${padded.join(" | ")} |`;
  };

  const separator = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;

  // First row is header (whether it was th or td)
  const header = matrix[0];
  if (!header) {
    return "";
  }
  const body = matrix.slice(1);
  return [formatRow(header), separator, ...body.map(formatRow)].join("\n");
}

/**
 * Walks all child nodes, concatenating their markdown output.
 */
export function walkChildren(node: Node, formatName: string, listDepth: number): string {
  return Array.from(node.childNodes)
    .map((child) => walkNode(child, formatName, listDepth))
    .join("");
}

/**
 * Walks child nodes, collapsing whitespace in text nodes.
 * Used for block-level elements (li, div) where HTML indentation is not meaningful.
 */
export function walkChildrenCollapsed(node: Node, formatName: string, listDepth: number): string {
  return Array.from(node.childNodes)
    .map((child) => {
      if (child.nodeType === child.TEXT_NODE) {
        return (child.textContent ?? "").replace(/\s+/g, " ");
      }
      return walkNode(child, formatName, listDepth);
    })
    .join("");
}

/**
 * Converts HTML to markdown using DOM parsing. Handles nested tags correctly.
 * Resolves all URLs to absolute IESDP links.
 * Also strips Jekyll liquid tags (both {{ }} and {% %}).
 */
export function htmlToMarkdown(text: string, formatName: string): string {
  const cleaned = text
    // Jekyll liquid expressions: extract quoted path from {{ "path" | prepend: relurl }}
    .replace(/\{\{\s*"([^"]+)"\s*\|\s*prepend:\s*relurl\s*\}\}/g, "$1")
    // Strip remaining liquid tags ({{ }} and {% %})
    .replace(/\{\{.*?\}\}/gs, "")
    .replace(/\{%.*?%\}/gs, "");

  const dom = new JSDOM(`<body>${cleaned}</body>`);
  const markdown = walkNode(dom.window.document.body, formatName).trim();

  // Also resolve URLs in markdown links that were already in the source text
  // (not converted from HTML, so the DOM walker didn't process them)
  return markdown.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, linkText: string, href: string) => `[${linkText}](${resolveIesdpUrl(href, formatName)})`,
  );
}

/**
 * Strips all markup (HTML, markdown, liquid) from text. Used for ID generation.
 */
export function stripAllMarkup(text: string): string {
  // Format name irrelevant -- URLs are stripped anyway
  return htmlToMarkdown(text, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Markdown links
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Markdown bold
    .replace(/`([^`]+)`/g, "$1"); // Markdown code
}
