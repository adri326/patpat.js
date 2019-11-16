const parser = require("./parser.js");
const KINDS = require("./kinds.js");
const interpreter = require("./interpreter.js");
const prelude = module.exports = {};
const {RuntimeError} = require("./errors.js");

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
  },
  "#for": {
    kind: KINDS.PATTERN,
    _execute: (args, context_stack) => {
      let from = args[0];
      let to = args[1];
      let step = 1;
      let fn;
      if (args.length === 3) {
        fn = args[2];
      } else {
        step = args[2];
        fn = args[3];
      }

      if (!fn || fn.kind !== KINDS.FUNCTION && fn.kind !== KINDS.PATTERN) {
        throw new RuntimeError("Last argument must be a function!");
      }

      let last_value = null;
      for (let x = from; x < to; x += step) {
        if (typeof fn._execute === "function") {
          last_value = fn._execute([x], context_stack);
        } else {
          last_value = interpreter.call_raw(fn, [x], context_stack);
        }
      }
      return last_value;
    }
  },
  "'ident": { // This will probably be deleted soon
    kind: KINDS.PATTERN,
    _execute: ([value], context_stack) => {
      return {
        kind: KINDS.FUNCTION,
        args: [],
        body: {
          kind: KINDS.BLOCK,
          instructions: [{
            kind: KINDS.SYMBOL,
            name: "__value"
          }]
        },
        context_stack: context_stack.concat({
          symbols: {
            __value: value
          },
          patterns: {}
        })
      };
    }
  }
}

prelude.symbols = {};
