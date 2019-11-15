const KINDS = module.exports = {
  TUPLE: Symbol("TUPLE"),
  STRING: Symbol("STRING"),
  NUMBER: Symbol("NUMBER"),
  BOOLEAN: Symbol("BOOLEAN"),
  PATTERN: Symbol("PATTERN"),
  NEXT_ELEMENT: Symbol("NEXT_ELEMENT"),
  DEFINE_SYMBOL: Symbol("DEFINE_SYMBOL"),
  DEFINE_PATTERN: Symbol("DEFINE_PATTERN"),
  DEFINE_COMPLEX: Symbol("DEFINE_COMPLEX"),
  DEFINE: Symbol("DEFINE"),
  SYMBOL: Symbol("SYMBOL"),
  OPERATOR: Symbol("OPERATOR"),
  OP_ADD: Symbol("OP_ADD"),
  OP_SUB: Symbol("OP_SUB"),
  OP_MUL: Symbol("OP_MUL"),
  OP_DIV: Symbol("OP_DIV"),
  OP_AND: Symbol("OP_AND"),
  OP_OR: Symbol("OP_OR"),
  OP_NOT: Symbol("OP_NOT"),

  ARRAY: Symbol("ARRAY"),

  FUNCTION_CALL: Symbol("FUNCTION_CALL"),
  PATTERN_CALL: Symbol("PATTERN_CALL"),
  EXPRESSION: Symbol("EXPRESSION")
};
