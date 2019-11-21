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
  OPERATOR: Symbol("OPERATOR"),
  ARROW: Symbol("ARROW"),
  LET: Symbol("LET"),
  SEPARATOR: Symbol("SEPARATOR"),

  OP_ADD: Symbol("OP_ADD"),
  OP_SUB: Symbol("OP_SUB"),
  OP_MUL: Symbol("OP_MUL"),
  OP_DIV: Symbol("OP_DIV"),
  OP_MOD: Symbol("OP_MOD"),
  OP_AND: Symbol("OP_AND"),
  OP_OR: Symbol("OP_OR"),
  OP_NOT: Symbol("OP_NOT"),
  OP_EQ: Symbol("OP_EQ"),

  FUNCTION_CALL: Symbol("FUNCTION_CALL"),
  PATTERN_CALL: Symbol("PATTERN_CALL"),
  EXPRESSION: Symbol("EXPRESSION"),
  UNARY_EXPRESSION: Symbol("UNARY_EXPRESSION"),
  FUNCTION: Symbol("FUNCTION"),
  BLOCK: Symbol("BLOCK"),
  DECLARE_SYMBOL: Symbol("DECLARE_SYMBOL")
};

KINDS.BINARY_OPS = [
  KINDS.OP_ADD,
  KINDS.OP_MUL,
  KINDS.OP_SUB,
  KINDS.OP_DIV,
  KINDS.OP_MOD,
  KINDS.OP_AND,
  KINDS.OP_OR,
  KINDS.OP_EQ
];

KINDS.UNARY_OPS = [
  KINDS.OP_NOT
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
  KINDS.EXPRESSION
];
