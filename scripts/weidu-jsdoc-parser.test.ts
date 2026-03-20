/**
 * Tests for WeiDU JSDoc parser.
 *
 * Parses JSDoc-style comments from WeiDU .tpa files to generate documentation.
 */

import { describe, it, expect } from 'vitest';
import {
  parseWeiduJsDoc,
  parseJsDocBlock,
  parseFunctionSignature,
} from './weidu-jsdoc-parser';

/** Type-narrowing assertion for test results. */
function assertDefined<T>(value: T | null | undefined): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined');
  }
}

describe('parseJsDocBlock', () => {
  it('parses description from comment block', () => {
    const comment = `/**
 * Returns coordinates of center point.
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.description).toBe('Returns coordinates of center point.');
  });

  it('parses multi-line description', () => {
    const comment = `/**
 * Returns coordinates of center point
 * and matched items.
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.description).toBe('Returns coordinates of center point\nand matched items.');
  });

  it('parses @param with type and description', () => {
    const comment = `/**
 * Description.
 * @param {int} index - Structure index
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.params).toHaveLength(1);
    const param0 = result.params[0];
    assertDefined(param0);
    expect(param0).toEqual({
      name: 'index',
      type: 'int',
      description: 'Structure index',
      required: false,
    });
  });

  it('parses @param with required marker (!)', () => {
    const comment = `/**
 * Description.
 * @param {int} index! - Structure index (required)
 */`;
    const result = parseJsDocBlock(comment);
    const param0 = result.params[0];
    assertDefined(param0);
    expect(param0.required).toBe(true);
    expect(param0.name).toBe('index');
  });

  it('parses @param without explicit type (defaults to string)', () => {
    const comment = `/**
 * Description.
 * @param filter - Filter pattern
 */`;
    const result = parseJsDocBlock(comment);
    const param0 = result.params[0];
    assertDefined(param0);
    expect(param0.type).toBe('string');
    expect(param0.name).toBe('filter');
  });

  it('parses multiple @param tags', () => {
    const comment = `/**
 * Description.
 * @param {int} index! - Structure index
 * @param {int} offset - Optional offset
 * @param {string} filter - Filter pattern
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.params).toHaveLength(3);
    expect(result.params[0]?.name).toBe('index');
    expect(result.params[1]?.name).toBe('offset');
    expect(result.params[2]?.name).toBe('filter');
  });

  it('parses @return with name and type', () => {
    const comment = `/**
 * Description.
 * @return x {int} - X coordinate of center
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.returns).toHaveLength(1);
    const ret0 = result.returns[0];
    assertDefined(ret0);
    expect(ret0).toEqual({
      name: 'x',
      type: 'int',
      description: 'X coordinate of center',
    });
  });

  it('parses multiple @return tags', () => {
    const comment = `/**
 * Description.
 * @return x {int} - X coordinate
 * @return y {int} - Y coordinate
 * @return items {array} - Matched items
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.returns).toHaveLength(3);
    expect(result.returns[0]?.name).toBe('x');
    expect(result.returns[1]?.name).toBe('y');
    expect(result.returns[2]?.name).toBe('items');
  });

  it('parses @deprecated tag', () => {
    const comment = `/**
 * Description.
 * @deprecated Use GET_CENTER_V2 instead
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.deprecated).toBe('Use GET_CENTER_V2 instead');
  });

  it('handles empty comment block', () => {
    const comment = `/**
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.description).toBe('');
    expect(result.params).toHaveLength(0);
    expect(result.returns).toHaveLength(0);
  });
});

describe('parseFunctionSignature', () => {
  it('parses DEFINE_PATCH_FUNCTION name', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_CENTER
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.name).toBe('GET_CENTER');
    expect(result.type).toBe('patch');
  });

  it('parses DEFINE_ACTION_FUNCTION name', () => {
    const code = `DEFINE_ACTION_FUNCTION IS_ITEM_IN_AREA
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.name).toBe('IS_ITEM_IN_AREA');
    expect(result.type).toBe('action');
  });

  it('parses INT_VAR with defaults', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_CENTER
  INT_VAR
    index = 0
    offset = 0
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.intVars).toEqual({
      index: '0',
      offset: '0',
    });
  });

  it('parses STR_VAR with defaults', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_CENTER
  STR_VAR
    filter = ""
    name = "default"
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.strVars).toEqual({
      filter: '""',
      name: '"default"',
    });
  });

  it('parses RET values', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_CENTER
  RET
    x
    y
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.ret).toEqual(['x', 'y']);
  });

  it('parses RET_ARRAY values', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_CENTER
  RET_ARRAY
    items
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.retArray).toEqual(['items']);
  });

  it('parses complex function with all sections', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_CENTER
  INT_VAR
    index = 0
    offset = 0
  STR_VAR
    filter = ""
  RET
    x
    y
  RET_ARRAY
    items
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.name).toBe('GET_CENTER');
    expect(result.type).toBe('patch');
    expect(result.intVars).toEqual({ index: '0', offset: '0' });
    expect(result.strVars).toEqual({ filter: '""' });
    expect(result.ret).toEqual(['x', 'y']);
    expect(result.retArray).toEqual(['items']);
  });

  it('handles inline RET', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_ARMOR_BASE_AC
  RET base_ac
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.ret).toEqual(['base_ac']);
  });

  it('handles negative default values', () => {
    const code = `DEFINE_PATCH_FUNCTION ALTER_AREA_REGION
  INT_VAR
    trapped = "-1"
    trap_detect = "-1"
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.intVars).toEqual({
      trapped: '"-1"',
      trap_detect: '"-1"',
    });
  });
});

describe('parseWeiduJsDoc', () => {
  it('parses a complete function with JSDoc', () => {
    const code = `/**
 * Returns coordinates of center point and matched items.
 *
 * @param {int} index! - Structure index (required)
 * @param {int} offset - Optional offset
 * @param {string} filter - Filter pattern
 * @return x {int} - X coordinate of center
 * @return y {int} - Y coordinate of center
 * @return items {array} - Array of matched item resrefs
 * @deprecated Use GET_CENTER_V2 instead
 */
DEFINE_PATCH_FUNCTION GET_CENTER
  INT_VAR
    index = 0
    offset = 0
  STR_VAR
    filter = ""
  RET
    x
    y
  RET_ARRAY
    items
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    expect(result).toHaveLength(1);

    const func = result[0];
    assertDefined(func);
    expect(func.name).toBe('GET_CENTER');
    expect(func.type).toBe('patch');
    expect(func.description).toBe('Returns coordinates of center point and matched items.');
    expect(func.deprecated).toBe('Use GET_CENTER_V2 instead');

    // Params should have defaults merged from signature
    expect(func.params).toHaveLength(3);
    expect(func.params[0]).toMatchObject({
      name: 'index',
      type: 'int',
      required: true,
    });
    expect(func.params[1]).toMatchObject({
      name: 'offset',
      type: 'int',
      required: false,
      default: '0',
    });
    expect(func.params[2]).toMatchObject({
      name: 'filter',
      type: 'string',
      required: false,
      default: '""',
    });

    // Returns
    expect(func.returns).toHaveLength(3);
    expect(func.returns[0]).toMatchObject({ name: 'x', type: 'int' });
    expect(func.returns[1]).toMatchObject({ name: 'y', type: 'int' });
    expect(func.returns[2]).toMatchObject({ name: 'items', type: 'array', isArray: true });
  });

  it('parses multiple functions from a file', () => {
    const code = `/**
 * First function.
 */
DEFINE_PATCH_FUNCTION FUNC_ONE
BEGIN
END

/**
 * Second function.
 */
DEFINE_ACTION_FUNCTION FUNC_TWO
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('FUNC_ONE');
    expect(result[1]?.name).toBe('FUNC_TWO');
  });

  it('skips functions without JSDoc', () => {
    const code = `DEFINE_PATCH_FUNCTION NO_DOCS
BEGIN
END

/**
 * Has docs.
 */
DEFINE_PATCH_FUNCTION HAS_DOCS
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('HAS_DOCS');
  });

  it('infers param type from INT_VAR/STR_VAR if not in JSDoc', () => {
    const code = `/**
 * Function with untyped params.
 * @param index - The index
 * @param name - The name
 */
DEFINE_PATCH_FUNCTION TEST_FUNC
  INT_VAR
    index = 0
  STR_VAR
    name = ""
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    // index is in INT_VAR, so should be int
    expect(func.params[0]?.type).toBe('int');
    // name is in STR_VAR, so should be string
    expect(func.params[1]?.type).toBe('string');
  });

  it('handles functions with no params or returns', () => {
    const code = `/**
 * Simple function with no params.
 */
DEFINE_PATCH_FUNCTION SIMPLE_FUNC
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    expect(func.params).toHaveLength(0);
    expect(func.returns).toHaveLength(0);
  });

  it('handles real-world example from areas.tpa', () => {
    const code = `/**
 * Alters area region properties by matching script name.
 * @param {int} trapped - Set trapped flag
 * @param {int} trap_detect - Trap detection difficulty
 * @param {int} trap_remove - Trap removal difficulty
 * @param {int} flag_trap_detectable - Whether trap is detectable
 * @param {string} match_script! - Script name to match (required)
 */
DEFINE_PATCH_FUNCTION ALTER_AREA_REGION_MATCH
  INT_VAR
  trapped = "-1"
  trap_detect = "-1"
  trap_remove = "-1"
  flag_trap_detectable = "-1"
  STR_VAR
  match_script = "-1"
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    expect(result).toHaveLength(1);
    const func = result[0];
    assertDefined(func);
    expect(func.name).toBe('ALTER_AREA_REGION_MATCH');
    expect(func.params).toHaveLength(5);
    expect(func.params[4]).toMatchObject({
      name: 'match_script',
      type: 'string',
      required: true,
    });
  });

  it('handles function with nested END at column 0', () => {
    const code = `/**
 * Function with nested blocks.
 * @param {int} index - The index
 * @return result {int} - The result
 */
DEFINE_PATCH_FUNCTION NESTED_BLOCKS
  INT_VAR
  index = 0
  RET
  result
BEGIN
READ_LONG 0x00 value
PATCH_IF (value > 0) BEGIN
  SET result = 1
END ELSE BEGIN
  SET result = 0
END
END`;
    const result = parseWeiduJsDoc(code);
    expect(result).toHaveLength(1);
    const func = result[0];
    assertDefined(func);
    expect(func.name).toBe('NESTED_BLOCKS');
    expect(func.params).toHaveLength(1);
    expect(func.params[0]?.name).toBe('index');
    expect(func.returns).toHaveLength(1);
    expect(func.returns[0]?.name).toBe('result');
  });
});

describe('parseJsDocBlock edge cases', () => {
  it('handles @param with no description', () => {
    const comment = `/**
 * Description.
 * @param {int} index
 */`;
    const result = parseJsDocBlock(comment);
    const param0 = result.params[0];
    assertDefined(param0);
    expect(param0).toEqual({
      name: 'index',
      type: 'int',
      description: '',
      required: false,
    });
  });

  it('handles @return with no description', () => {
    const comment = `/**
 * Description.
 * @return x {int}
 */`;
    const result = parseJsDocBlock(comment);
    const ret0 = result.returns[0];
    assertDefined(ret0);
    expect(ret0).toEqual({
      name: 'x',
      type: 'int',
      description: '',
    });
  });

  it('handles @return without explicit type (defaults to string)', () => {
    const comment = `/**
 * Description.
 * @return result - The result
 */`;
    const result = parseJsDocBlock(comment);
    const ret0 = result.returns[0];
    assertDefined(ret0);
    expect(ret0.type).toBe('string');
    expect(ret0.name).toBe('result');
  });

  it('handles description with special characters', () => {
    const comment = `/**
 * Returns "quoted" value & special <chars>.
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.description).toBe('Returns "quoted" value & special <chars>.');
  });

  it('handles multi-line @param description', () => {
    const comment = `/**
 * Description.
 * @param {int} index - Structure index
 *   that spans multiple lines
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.params[0]?.description).toBe('Structure index that spans multiple lines');
  });

  it('handles @param with resref type', () => {
    const comment = `/**
 * Description.
 * @param {resref} item - Item resource reference
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.params[0]?.type).toBe('resref');
  });

  it('handles @param with ids type', () => {
    const comment = `/**
 * Description.
 * @param {ids} alignment - Alignment IDS value
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.params[0]?.type).toBe('ids');
  });

  it('handles @return with array type', () => {
    const comment = `/**
 * Description.
 * @return items {array} - Array of items
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.returns[0]?.type).toBe('array');
  });

  it('handles @return with map type', () => {
    const comment = `/**
 * Description.
 * @return mapping {map} - Associative array
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.returns[0]?.type).toBe('map');
  });

  it('handles @return with bool type', () => {
    const comment = `/**
 * Description.
 * @return found {bool} - Whether item was found
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.returns[0]?.type).toBe('bool');
  });

  it('handles empty @deprecated', () => {
    const comment = `/**
 * Description.
 * @deprecated
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.deprecated).toBe('');
  });

  it('preserves whitespace in description for code blocks', () => {
    const comment = `/**
 * Example:
 * \`\`\`
 * COPY_EXISTING item.itm override
 *   LPF FUNC END
 * \`\`\`
 */`;
    const result = parseJsDocBlock(comment);
    expect(result.description).toContain('```');
  });
});

describe('parseFunctionSignature edge cases', () => {
  it('handles function with only RET on same line', () => {
    const code = `DEFINE_PATCH_FUNCTION GET_VALUE RET value
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.ret).toEqual(['value']);
  });

  it('handles function with mixed inline and multiline vars', () => {
    const code = `DEFINE_PATCH_FUNCTION MIXED
  INT_VAR index = 0
  STR_VAR
    name = ""
    type = "default"
  RET result
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.intVars).toEqual({ index: '0' });
    expect(result.strVars).toEqual({ name: '""', type: '"default"' });
    expect(result.ret).toEqual(['result']);
  });

  it('handles empty tilde strings', () => {
    const code = `DEFINE_PATCH_FUNCTION TEST
  STR_VAR
    name = ~~
    type = ~default~
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.strVars).toEqual({ name: '~~', type: '~default~' });
  });

  it('handles percent-delimited strings', () => {
    const code = `DEFINE_PATCH_FUNCTION TEST
  STR_VAR
    path = ~%MOD_FOLDER%/file~
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.strVars).toEqual({ path: '~%MOD_FOLDER%/file~' });
  });

  it('handles multiple RET on separate lines', () => {
    const code = `DEFINE_PATCH_FUNCTION MULTI_RET
  RET
    a
    b
    c
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.ret).toEqual(['a', 'b', 'c']);
  });

  it('handles both RET and RET_ARRAY', () => {
    const code = `DEFINE_PATCH_FUNCTION BOTH_RET
  RET value
  RET_ARRAY items
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.ret).toEqual(['value']);
    expect(result.retArray).toEqual(['items']);
  });

  it('handles comments in function signature', () => {
    const code = `DEFINE_PATCH_FUNCTION WITH_COMMENTS
  INT_VAR
    index = 0 // default index
    offset = 10
BEGIN
END`;
    const result = parseFunctionSignature(code);
    assertDefined(result);
    expect(result.intVars).toEqual({ index: '0', offset: '10' });
  });

  it('returns null for non-function code', () => {
    const code = `OUTER_SET value = 5`;
    const result = parseFunctionSignature(code);
    expect(result).toBeNull();
  });
});

describe('parseWeiduJsDoc edge cases', () => {
  it('handles file with no functions', () => {
    const code = `// Just a comment
OUTER_SET value = 5`;
    const result = parseWeiduJsDoc(code);
    expect(result).toHaveLength(0);
  });

  it('handles JSDoc not immediately before function', () => {
    const code = `/**
 * This is a file-level comment.
 */

// Some other code here
OUTER_SET x = 1

DEFINE_PATCH_FUNCTION NO_DOC
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    // Should not associate file-level comment with function
    expect(result).toHaveLength(0);
  });

  it('handles param documented but not in signature', () => {
    const code = `/**
 * Function description.
 * @param {int} extra - Extra param not in signature
 */
DEFINE_PATCH_FUNCTION TEST
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    // Should still include the documented param
    expect(func.params).toHaveLength(1);
    expect(func.params[0]?.name).toBe('extra');
  });

  it('handles param in signature but not documented', () => {
    const code = `/**
 * Function description.
 */
DEFINE_PATCH_FUNCTION TEST
  INT_VAR
    undocumented = 0
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    // Should include undocumented param with inferred type
    expect(func.params).toHaveLength(1);
    expect(func.params[0]).toMatchObject({
      name: 'undocumented',
      type: 'int',
      default: '0',
    });
  });

  it('handles return in signature but not documented', () => {
    const code = `/**
 * Function description.
 */
DEFINE_PATCH_FUNCTION TEST
  RET result
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    // Should include undocumented return
    expect(func.returns).toHaveLength(1);
    expect(func.returns[0]?.name).toBe('result');
  });

  it('marks RET_ARRAY returns with isArray flag', () => {
    const code = `/**
 * Function description.
 * @return items {array} - The items
 */
DEFINE_PATCH_FUNCTION TEST
  RET_ARRAY items
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    expect(func.returns[0]?.isArray).toBe(true);
  });

  it('handles Windows line endings (CRLF)', () => {
    const code = "/**\r\n * Description.\r\n */\r\nDEFINE_PATCH_FUNCTION TEST\r\nBEGIN\r\nEND";
    const result = parseWeiduJsDoc(code);
    expect(result).toHaveLength(1);
    const func = result[0];
    assertDefined(func);
    expect(func.description).toBe('Description.');
  });

  it('handles tabs in indentation', () => {
    const code = `/**
 * Description.
 */
DEFINE_PATCH_FUNCTION TEST
\tINT_VAR
\t\tindex = 0
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    expect(func.params).toHaveLength(1);
    expect(func.params[0]?.name).toBe('index');
  });

  it('orders params by their appearance in signature', () => {
    const code = `/**
 * Description.
 * @param {string} name - Name param
 * @param {int} index - Index param
 */
DEFINE_PATCH_FUNCTION TEST
  INT_VAR
    index = 0
  STR_VAR
    name = ""
BEGIN
END`;
    const result = parseWeiduJsDoc(code);
    const func = result[0];
    assertDefined(func);
    // Should follow signature order: INT_VAR first, then STR_VAR
    expect(func.params[0]?.name).toBe('index');
    expect(func.params[1]?.name).toBe('name');
  });
});
