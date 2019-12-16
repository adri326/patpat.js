const KINDS = require("./kinds.js");
const interpreter = require("./interpreter.js");
const prelude = require("./prelude.js");
const Context = require("./context.js");

module.exports = class Struct {
  constructor({name, symbols, patterns, line, char}) {
    this.kind = KINDS.STRUCT;
    this.name = name;
    this.symbols = symbols;
    this.patterns = patterns;
    this.line = line;
    this.char = char;
    this.operators = {};
    for (let name in patterns) {
      let pattern = patterns[name];
      let matching_operator = KINDS.OPERATOR_EQUIVS.find(([a, b]) => b === name);
      if (matching_operator) {
        this.operators[matching_operator[0]] = function struct_operator(a, b, context_stack, instruction) {
          return interpreter.call_raw(pattern, [b], context_stack, instruction, {instance: a});
        };
      }
    }
  }

  instance() {
    return new StructInstance(this);
  }
}

const StructInstance = module.exports.StructInstance = class StructInstance {
  constructor(parent) {
    this.parent = parent;
    this.kind = KINDS.STRUCT_INSTANCE;
    this.symbols = {};
    for (let name in parent.symbols) {
      if (parent.symbols[name].default_value !== null) {
        this.symbols[name] = interpreter.interprete_instruction(
          parent.symbols[name].default_value,
          new Context().tail([prelude])
        );
      } else {
        this.symbols[name] = null;
      }
    }
  }

  to_context() {
    return new Context({
      self: {...this, patterns: this.parent.patterns, structs: {}}
    });
  }
}
