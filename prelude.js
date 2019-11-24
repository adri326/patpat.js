const parser = require("./parser.js");
const KINDS = require("./kinds.js");
const interpreter = require("./interpreter.js");
const prelude = module.exports;
const {RuntimeError} = require("./errors.js");

prelude.patterns = {
  "'println": {
    kind: KINDS.PATTERN,
    name: "'println",
    instructions: [],
    _execute: (args) => {
      prelude.stdout.write(args.join(" ") + "\n");
    }
  },
  "'print": {
    kind: KINDS.PATTERN,
    name: "'print",
    instructions: [],
    _execute: (args) => {
      prelude.stdout.write(args.join(" "));
    }
  },
  "'version": {
    kind: KINDS.PATTERN,
    name: "'version",
    args: [],
    body: {
      instructions: [{
        kind: KINDS.STRING,
        string: "0.0.2"
      }]
    }
  },
  "#if": {
    kind: KINDS.PATTERN,
    name: "#if",
    args: [
      {name: "condition",optional: false},
      {name: "success", optional: false},
      {name: "error", optional: true, default: null}
    ],
    _execute: ([condition, success, error], context_stack, line, char) => {
      if (!success) {
        throw new RuntimeError("Invalid first argument type, expected FUNCTION or PATTERN, got " + success + " (in " + this.name + ")", line, char);
      }
      if (success.kind !== KINDS.FUNCTION && success.kind !== KINDS.PATTERN) {
        throw new RuntimeError("Invalid argument type, expected FUNCTION or PATTERN, got " + success.kind.description, success.line, success.char);
      }
      if (error && error.kind !== KINDS.FUNCTION && error.kind !== KINDS.PATTERN) {
        throw new RuntimeError("Invalid argument type, expected FUNCTION or PATTERN, got " + error.kind.description, error.line, error.char);
      }

      if (condition) {
        if (success._execute) {
          return success._execute([], context_stack, line, char);
        } else {
          return interpreter(success.body, context_stack);
        }
      } else if (error) {
        if (error._execute) {
          return condition._execute([], context_stack, line, char);
        } else {
          return interpreter(error.body, context_stack);
        }
      } else {
        return null;
      }
    }
  },
  "#for": {
    kind: KINDS.PATTERN,
    name: "#for",
    args: [
      {name: "from", optional: false},
      {name: "to", optional: true},
      {name: "fn", optional: false}
    ],
    _execute: (args, context_stack, line, char) => {
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
        throw new RuntimeError("Last argument must be a function!", line, char);
      }

      let last_value = null;
      for (let x = from; x < to; x += step) {
        let result;
        if (typeof fn._execute === "function") {
          result = fn._execute([x], context_stack, line, char);
        } else {
          result = interpreter.call_raw(fn, [x], context_stack);
        }
        if (Array.isArray(result) && result[0] === prelude.symbols.__break) {
          return result[1];
        }
        last_value = result;
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
  },
  "#break": {
    kind: KINDS.PATTERN,
    args: [
      {
        name: "__value",
        optional: true
      }
    ],
    body: {
      instructions: [{
        kind: KINDS.TUPLE,
        instructions: [
          {
            kind: KINDS.SYMBOL,
            name: "__break"
          },
          {kind: KINDS.NEXT_ELEMENT},
          {
            kind: KINDS.SYMBOL,
            name: "__value"
          }
        ]
      }],
    }
  },
  "#error": {
    kind: KINDS.PATTERN,
    args: [
      {
        name: "value",
        optional: true
      }
    ],
    _execute: ([value], _, line, char) => {
      throw new RuntimeError("Runtime Error" + (value ? ": " + value : ""), line, char);
    }
  }
}

prelude.symbols = {
  __break: Symbol("BREAK")
};

prelude.structs = {};
