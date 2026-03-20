/**
 * Tests for JSDoc to Markdown conversion.
 */

import { describe, it, expect } from "vitest";
import {
  typeLink,
  cleanDefault,
  formatDefault,
  renderParamsTable,
  renderReturnsTable,
  renderFunction,
  renderSectionPage,
  renderTypesPage,
} from "./jsdoc-to-md";
import type { JsDocParam, WeiduFunction } from "./weidu-jsdoc-parser";

describe("typeLink", () => {
  it("links known types", () => {
    expect(typeLink("int")).toBe("[int](/types#int)");
    expect(typeLink("resref")).toBe("[resref](/types#resref)");
    expect(typeLink("bool")).toBe("[bool](/types#bool)");
  });

  it("returns unknown types as-is", () => {
    expect(typeLink("custom")).toBe("custom");
    expect(typeLink("unknown")).toBe("unknown");
  });
});

describe("cleanDefault", () => {
  it("strips tilde delimiters", () => {
    expect(cleanDefault("~value~")).toBe("value");
  });

  it("strips quote delimiters", () => {
    expect(cleanDefault('"value"')).toBe("value");
  });

  it("returns plain values unchanged", () => {
    expect(cleanDefault("10")).toBe("10");
  });
});

describe("formatDefault", () => {
  it("returns required span for required params", () => {
    expect(formatDefault({ type: "int", required: true })).toBe(
      '<span class="required">required</span>',
    );
  });

  it("returns empty for no default", () => {
    expect(formatDefault({ type: "int", required: false })).toBe("");
  });

  it("returns empty for empty string default", () => {
    expect(formatDefault({ type: "string", required: false, default: '""' })).toBe("");
  });

  it("returns empty for sentinel -1 default", () => {
    expect(formatDefault({ type: "int", required: false, default: '"-1"' })).toBe("");
  });

  it("converts bool 1 to True", () => {
    expect(formatDefault({ type: "bool", required: false, default: "1" })).toBe("True");
  });

  it("converts bool 0 to False", () => {
    expect(formatDefault({ type: "bool", required: false, default: "0" })).toBe("False");
  });

  it("returns cleaned default for non-bool", () => {
    expect(formatDefault({ type: "int", required: false, default: "10" })).toBe("10");
  });
});

describe("renderParamsTable", () => {
  it("renders a params table with sorted entries", () => {
    const params: JsDocParam[] = [
      { name: "beta", type: "string", description: "Second", required: false, varType: "STR_VAR" },
      { name: "alpha", type: "int", description: "First", required: true, varType: "INT_VAR" },
    ];
    const lines = renderParamsTable("INT_VAR", params);
    expect(lines[0]).toBe("| **INT_VAR** | **Description** | **Type** | **Default** |");
    expect(lines[1]).toBe("|---|---|---|---|");
    // alpha should come before beta (sorted)
    expect(lines[2]).toContain("alpha");
    expect(lines[3]).toContain("beta");
  });

  it("escapes pipe characters in descriptions", () => {
    const params: JsDocParam[] = [
      { name: "x", type: "int", description: "a | b", required: false, varType: "INT_VAR" },
    ];
    const lines = renderParamsTable("INT_VAR", params);
    expect(lines[2]).toContain("a \\| b");
  });
});

describe("renderReturnsTable", () => {
  it("renders a returns table", () => {
    const returns = [
      { name: "result", type: "int", description: "The result" },
    ];
    const lines = renderReturnsTable(returns);
    expect(lines[0]).toContain("**Return**");
    expect(lines[2]).toContain("result");
    expect(lines[2]).toContain("[int](/types#int)");
  });
});

describe("renderFunction", () => {
  it("renders a function with badge, params and returns", () => {
    const func: WeiduFunction = {
      name: "TEST_FUNC",
      type: "patch",
      description: "Test function description",
      params: [
        {
          name: "index",
          type: "int",
          description: "The index",
          required: true,
          default: "0",
          varType: "INT_VAR",
        },
      ],
      returns: [
        { name: "result", type: "int", description: "The result" },
      ],
    };

    const md = renderFunction(func);
    expect(md).toContain('## TEST_FUNC <Badge type="tip" text="patch" />');
    expect(md).toContain("Test function description");
    expect(md).toContain("| **INT_VAR**");
    expect(md).toContain("| **Return**");
  });

  it("uses info badge for action functions", () => {
    const func: WeiduFunction = {
      name: "DO_THING",
      type: "action",
      description: "Does a thing",
      params: [],
      returns: [],
    };

    const md = renderFunction(func);
    expect(md).toContain('<Badge type="info" text="action" />');
  });
});

describe("renderSectionPage", () => {
  it("renders a full section page with frontmatter and TOC", () => {
    const section = { name: "creatures", title: "Creatures", desc: "Creatures functions." };
    const functions: WeiduFunction[] = [
      {
        name: "FUNC_B",
        type: "patch",
        description: "Second",
        params: [],
        returns: [],
      },
      {
        name: "FUNC_A",
        type: "action",
        description: "First",
        params: [],
        returns: [],
      },
    ];

    const md = renderSectionPage(section, functions);
    expect(md).toContain("title: Creatures");
    expect(md).toContain("# Creatures");
    expect(md).not.toContain("[[toc]]");
    // Functions should be sorted
    expect(md.indexOf("FUNC_A")).toBeLessThan(md.indexOf("FUNC_B"));
  });
});

describe("renderTypesPage", () => {
  it("renders the types page", () => {
    const types = [
      { name: "int", desc: "Integer value." },
      { name: "bool", desc: "0 or 1." },
    ];

    const md = renderTypesPage(types);
    expect(md).toContain("# Types");
    expect(md).toContain("## int");
    expect(md).toContain("Integer value.");
    expect(md).toContain("## bool");
  });
});
