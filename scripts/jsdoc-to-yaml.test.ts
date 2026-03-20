/**
 * Tests for JSDoc to YAML conversion.
 */

import { describe, it, expect } from "vitest";
import * as yaml from "js-yaml";
import { paramToYaml, serializeYaml, functionToYaml } from "./jsdoc-to-yaml";
import type { JsDocParam, WeiduFunction } from "./weidu-jsdoc-parser";

describe("paramToYaml", () => {
  it("converts a required param", () => {
    const param: JsDocParam = {
      name: "index",
      type: "int",
      description: "Structure index",
      required: true,
      varType: "INT_VAR",
    };
    const result = paramToYaml(param);
    expect(result).toEqual({
      name: "index",
      desc: "Structure index",
      type: "int",
      required: 1,
    });
  });

  it("converts a param with default value", () => {
    const param: JsDocParam = {
      name: "offset",
      type: "int",
      description: "Offset",
      required: false,
      default: "10",
      varType: "INT_VAR",
    };
    const result = paramToYaml(param);
    expect(result).toEqual({
      name: "offset",
      desc: "Offset",
      type: "int",
      default: "10",
    });
  });

  it("strips tilde delimiters from default", () => {
    const param: JsDocParam = {
      name: "name",
      type: "string",
      description: "Name",
      required: false,
      default: "~value~",
      varType: "STR_VAR",
    };
    const result = paramToYaml(param);
    expect(result.default).toBe("value");
  });

  it("strips quote delimiters from default", () => {
    const param: JsDocParam = {
      name: "name",
      type: "string",
      description: "Name",
      required: false,
      default: '"value"',
      varType: "STR_VAR",
    };
    const result = paramToYaml(param);
    expect(result.default).toBe("value");
  });

  it("omits empty default", () => {
    const param: JsDocParam = {
      name: "name",
      type: "string",
      description: "Name",
      required: false,
      default: '""',
      varType: "STR_VAR",
    };
    const result = paramToYaml(param);
    expect(result.default).toBeUndefined();
  });

  it("omits sentinel -1 default", () => {
    const param: JsDocParam = {
      name: "val",
      type: "int",
      description: "Value",
      required: false,
      default: '"-1"',
      varType: "INT_VAR",
    };
    const result = paramToYaml(param);
    expect(result.default).toBeUndefined();
  });
});

describe("serializeYaml", () => {
  it("serializes a simple function list", () => {
    const functions = [
      {
        name: "FUNC_B",
        desc: "Second function",
        type: "patch",
      },
      {
        name: "FUNC_A",
        desc: "First function",
        type: "action",
      },
    ];
    const result = serializeYaml(functions);
    // Should be sorted alphabetically
    expect(result.indexOf("FUNC_A")).toBeLessThan(result.indexOf("FUNC_B"));
    expect(result).toContain("- name: FUNC_A");
    expect(result).toContain("  desc: First function");
    expect(result).toContain("  type: action");
  });

  it("handles multi-line descriptions with block scalar", () => {
    const functions = [
      {
        name: "TEST",
        desc: "Line one\nLine two",
        type: "patch",
      },
    ];
    const result = serializeYaml(functions);
    expect(result).toContain("  desc: |");
    expect(result).toContain("    Line one");
    expect(result).toContain("    Line two");
  });

  it("serializes params and returns", () => {
    const functions = [
      {
        name: "TEST",
        desc: "Description",
        type: "patch",
        int_params: [{ name: "x", desc: "X value", type: "int", required: 1 }],
        return: [{ name: "result", desc: "The result", type: "int" }],
      },
    ];
    const result = serializeYaml(functions);
    expect(result).toContain("  int_params:");
    expect(result).toContain("    - name: x");
    expect(result).toContain("      required: 1");
    expect(result).toContain("  return:");
    expect(result).toContain("    - name: result");
  });

  it("produces valid YAML when descriptions contain special characters", () => {
    const functions = [
      {
        name: "TEST",
        desc: "Sets value: the amount",
        type: "patch",
        int_params: [{ name: "x", desc: "param: value # comment", type: "int" }],
        return: [{ name: "r", desc: "result [bracketed]", type: "int" }],
      },
    ];
    const result = serializeYaml(functions);
    // Must be parseable as valid YAML
    const parsed = yaml.load(result) as Record<string, unknown>[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toHaveProperty("name", "TEST");
    expect(parsed[0]).toHaveProperty("desc", "Sets value: the amount");
  });

  it("produces valid YAML when description starts with YAML-significant chars", () => {
    const functions = [
      {
        name: "TEST",
        desc: "# not a comment",
        type: "patch",
      },
      {
        name: "TEST2",
        desc: "[bracketed] value",
        type: "action",
      },
      {
        name: "TEST3",
        desc: "{curly} value",
        type: "patch",
      },
    ];
    const result = serializeYaml(functions);
    const parsed = yaml.load(result) as Record<string, unknown>[];
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toHaveProperty("desc", "# not a comment");
    expect(parsed[1]).toHaveProperty("desc", "[bracketed] value");
    expect(parsed[2]).toHaveProperty("desc", "{curly} value");
  });
});

describe("functionToYaml", () => {
  it("converts a WeiduFunction to YamlFunction", () => {
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
        {
          name: "name",
          type: "string",
          description: "The name",
          required: false,
          default: '""',
          varType: "STR_VAR",
        },
      ],
      returns: [
        {
          name: "result",
          type: "int",
          description: "The result",
        },
      ],
    };

    const result = functionToYaml(func);
    expect(result.name).toBe("TEST_FUNC");
    expect(result.desc).toBe("Test function description");
    expect(result.type).toBe("patch");
    expect(result.int_params).toHaveLength(1);
    expect(result.int_params?.[0]?.name).toBe("index");
    expect(result.string_params).toHaveLength(1);
    expect(result.string_params?.[0]?.name).toBe("name");
    expect(result.return).toHaveLength(1);
    expect(result.return?.[0]?.name).toBe("result");
  });

  it("omits empty param/return sections", () => {
    const func: WeiduFunction = {
      name: "SIMPLE",
      type: "action",
      description: "Simple function",
      params: [],
      returns: [],
    };

    const result = functionToYaml(func);
    expect(result.int_params).toBeUndefined();
    expect(result.string_params).toBeUndefined();
    expect(result.return).toBeUndefined();
  });
});
