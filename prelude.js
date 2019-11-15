const parser = require("./parser.js");
const KINDS = require("./kinds.js");
const interpreter = require("./interpreter.js");
const prelude = module.exports = {};

prelude.patterns = {
  "'println": {
    kind: KINDS.PATTERN,
    instructions: [],
    _execute: (args) => {
      console.log(...args);
    }
  },
  "'version": {
    kind: KINDS.PATTERN,
    instructions: [{
      kind: KINDS.STRING,
      string: "0.0.2"
    }]
  },
  "#if": {
    kind: KINDS.PATTERN,
    _execute: ([condition, success, error], context_stack) => {
      if (success.kind !== KINDS.FUNCTION) {
        throw RuntimeError("Invalid argument type, expected FUNCTION, got " + success.kind.description, success.line, success.char);
      }
      if (error && error.kind !== KINDS.FUNCTION) {
        throw RuntimeError("Invalid argument type, expected FUNCTION, got " + error.kind.description, error.line, error.char);
      }

      if (condition) {
        return interpreter(success.body, context_stack);
      } else if (error) {
        return interpreter(error.body, context_stack);
      } else {
        return null;
      }
    }
  }
}

prelude.symbols = {};
