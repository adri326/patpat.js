const KINDS = module.exports = {
  TUPLE: Symbol("TUPLE"),
  STRING: Symbol("STRING"),
  NUMBER: Symbol("NUMBER"),
  BOOLEAN: Symbol("BOOLEAN"),
  PATTERN: Symbol("PATTERN"),
  ARRAY: Symbol("ARRAY"),
  NEXT_ELEMENT: Symbol("NEXT_ELEMENT"),
  DEFINE_SYMBOL: Symbol("DEFINE_SYMBOL"),
  DEFINE_PATTERN: Symbol("DEFINE_PATTERN"),
  DEFINE_COMPLEX: Symbol("DEFINE_COMPLEX"),
  DEFINE: Symbol("DEFINE"),
  SYMBOL: Symbol("SYMBOL"),
  TYPENAME: Symbol("TYPENAME"),
  OPERATOR: Symbol("OPERATOR"),
  ARROW: Symbol("ARROW"),
  LET: Symbol("LET"),
  STRUCT: Symbol("STRUCT"),
  SEPARATOR: Symbol("SEPARATOR"),
  MEMBER_ACCESSOR: Symbol("MEMBER_ACCESSOR"),
  DEFINE_MEMBER: Symbol("DEFINE_MEMBER"),
  INTERPETATION: Symbol("INTERPRETATION"),
  DEFINE_INTERPRETATION: Symbol("DEFINE_INTERPRETATION"),

  OP_ADD: Symbol("OP_ADD"),
  OP_SUB: Symbol("OP_SUB"),
  OP_MUL: Symbol("OP_MUL"),
  OP_DIV: Symbol("OP_DIV"),
  OP_MOD: Symbol("OP_MOD"),
  OP_AND: Symbol("OP_AND"),
  OP_OR: Symbol("OP_OR"),
  OP_NOT: Symbol("OP_NOT"),
  OP_EQ: Symbol("OP_EQ"),
  OP_NEQ: Symbol("OP_NEQ"),
  OP_GT: Symbol("OP_GT"),
  OP_GTE: Symbol("OP_GTE"),
  OP_LT: Symbol("OP_LT"),
  OP_LTE: Symbol("OP_LTE"),

  FUNCTION_CALL: Symbol("FUNCTION_CALL"),
  PATTERN_CALL: Symbol("PATTERN_CALL"),
  EXPRESSION: Symbol("EXPRESSION"),
  UNARY_EXPRESSION: Symbol("UNARY_EXPRESSION"),
  FUNCTION: Symbol("FUNCTION"),
  BLOCK: Symbol("BLOCK"),
  DECLARE_SYMBOL: Symbol("DECLARE_SYMBOL"),
  STRUCT_INSTANCE: Symbol("STRUCT_INSTANCE"),
  STRUCT_INIT: Symbol("STRUCT_INIT"),
  TYPE: Symbol("TYPE"),

  USE: Symbol("USE"),
  LOAD: Symbol("LOAD"),
  MODULE: Symbol("MODULE"),
  RAW: Symbol("RAW"),

  SELF: Symbol("SELF"),
  LHS: Symbol("LHS"),
  NOT_FOUND: Symbol("NOT_FOUND")
};

KINDS.BINARY_OPS = [
  KINDS.OP_ADD,
  KINDS.OP_MUL,
  KINDS.OP_SUB,
  KINDS.OP_DIV,
  KINDS.OP_MOD,
  KINDS.OP_AND,
  KINDS.OP_OR,
  KINDS.OP_EQ,
  KINDS.OP_NEQ,
  KINDS.OP_GT,
  KINDS.OP_GTE,
  KINDS.OP_LT,
  KINDS.OP_LTE
];

KINDS.UNARY_OPS = [
  KINDS.OP_NOT
];

KINDS.OPERATORS = [].concat(KINDS.BINARY_OPS, KINDS.UNARY_OPS);

KINDS.OPERATOR_EQUIVS = [
  [KINDS.OP_ADD, "#add"],
  [KINDS.OP_MUL, "#mul"],
  [KINDS.OP_SUB, "#sub"],
  [KINDS.OP_DIV, "#div"],
  [KINDS.OP_MOD, "#mod"],
  [KINDS.OP_AND, "#and"],
  [KINDS.OP_OR, "#or"],
  [KINDS.OP_EQ, "#eq"],
  [KINDS.OP_NEQ, "#neq"],
  [KINDS.OP_GT, "#gt"],
  [KINDS.OP_GTE, "#gte"],
  [KINDS.OP_LT, "#lt"],
  [KINDS.OP_LTE, "#lte"]
];

KINDS.VALID_EXP_TERMS = [
  KINDS.STRING,
  KINDS.NUMBER,
  KINDS.BOOLEAN,
  KINDS.ARRAY,
  KINDS.SYMBOL,
  KINDS.TUPLE,
  KINDS.FUNCTION_CALL,
  KINDS.PATTERN_CALL,
  KINDS.EXPRESSION,
  KINDS.MEMBER_ACCESSOR,
  KINDS.STRUCT_INIT,
  KINDS.DEFINE_MEMBER,
  KINDS.DEFINE_SYMBOL,
  KINDS.DEFINE_COMPLEX
];
