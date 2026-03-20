/**
 * Tests for IESDP structure utilities.
 */

import { describe, it, expect, vi } from "vitest";
import { getPrefix, generateId, getFieldSize, loadDatafile, ValidationError } from "./iesdp-structure";
import type { StructureItem } from "./iesdp-structure";

describe("getPrefix", () => {
  it("generates prefix for v1 header (no version suffix, no section suffix)", () => {
    expect(getPrefix("eff_v1", "header.yml")).toBe("EFF_");
  });

  it("generates prefix for v2 header (version suffix, no section suffix)", () => {
    expect(getPrefix("eff_v2", "header.yml")).toBe("EFF2_");
  });

  it("generates prefix for v1 body (no version, no section suffix)", () => {
    expect(getPrefix("eff_v1", "body.yml")).toBe("EFF_");
  });

  it("generates prefix for v2 body", () => {
    expect(getPrefix("eff_v2", "body.yml")).toBe("EFF2_");
  });

  it("generates prefix for extended_header (uses 'head' suffix)", () => {
    expect(getPrefix("itm_v1", "extended_header.yml")).toBe("ITM_HEAD_");
  });

  it("generates prefix for custom section name", () => {
    expect(getPrefix("spl_v1", "casting_feature.yml")).toBe("SPL_CASTING_FEATURE_");
  });

  it("generates prefix for v2 with custom section", () => {
    expect(getPrefix("eff_v2", "casting_feature.yml")).toBe("EFF2_CASTING_FEATURE_");
  });
});

describe("generateId", () => {
  it("uses custom id if provided", () => {
    const item: StructureItem = { desc: "Anything", type: "dword", id: "custom_id" };
    expect(generateId(item, "EFF_")).toBe("EFF_custom_id");
  });

  it("generates id from description", () => {
    const item: StructureItem = { desc: "Flags", type: "dword" };
    expect(generateId(item, "EFF_")).toBe("EFF_flags");
  });

  it("applies ID replacements (space -> underscore)", () => {
    const item: StructureItem = { desc: "Save type", type: "dword" };
    expect(generateId(item, "EFF_")).toBe("EFF_save_type");
  });

  it("throws ValidationError for invalid generated id", () => {
    const item: StructureItem = { desc: "Field [invalid]", type: "dword" };
    expect(() => generateId(item, "EFF_")).toThrow(ValidationError);
  });
});

describe("getFieldSize", () => {
  it("returns explicit length when provided", () => {
    const item: StructureItem = { desc: "Data", type: "bytes", length: 32 };
    expect(getFieldSize(item)).toBe(32);
  });

  it("returns byte size for known type", () => {
    expect(getFieldSize({ desc: "X", type: "byte" })).toBe(1);
    expect(getFieldSize({ desc: "X", type: "char" })).toBe(1);
    expect(getFieldSize({ desc: "X", type: "word" })).toBe(2);
    expect(getFieldSize({ desc: "X", type: "dword" })).toBe(4);
    expect(getFieldSize({ desc: "X", type: "resref" })).toBe(8);
    expect(getFieldSize({ desc: "X", type: "strref" })).toBe(4);
  });

  it("applies mult to known type size", () => {
    const item: StructureItem = { desc: "X", type: "byte", mult: 4 };
    expect(getFieldSize(item)).toBe(4);
  });

  it("throws ValidationError for unknown type without length", () => {
    const item: StructureItem = { desc: "X", type: "unknown_type" };
    expect(() => getFieldSize(item)).toThrow(ValidationError);
  });
});

vi.mock("./utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils.js")>();
  return { ...actual, readFile: vi.fn(actual.readFile), log: vi.fn(actual.log) };
});

describe("loadDatafile", () => {
  it("throws ValidationError on offset mismatch", async () => {
    const yamlContent = [
      "- desc: First Field",
      "  type: dword",
      "  offset: 0",
      "- desc: Second Field",
      "  type: dword",
      "  offset: 8",  // should be 4 (dword = 4 bytes), so this mismatches
    ].join("\n");

    const utils = await import("./utils.js");
    vi.mocked(utils.readFile).mockReturnValue(yamlContent);

    expect(() => loadDatafile("test.yml", "TEST_", "test_v1")).toThrow(ValidationError);
    expect(() => loadDatafile("test.yml", "TEST_", "test_v1")).toThrow(/offset mismatch/i);

    vi.mocked(utils.readFile).mockRestore();
  });
});
