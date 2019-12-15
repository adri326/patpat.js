const parser = require("./parser.js");
const KINDS = require("./kinds.js");
const interpreter = require("./interpreter.js");
const prelude = module.exports;
const {RuntimeError} = require("./errors.js");
const Context = require("./context.js");

prelude.sourced = {};

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
      {name: "condition", optional: false},
      {name: "success", optional: false}
    ],
    _execute: ([condition, success], context_stack, line, char) => {
      if (!success) {
        throw new RuntimeError("Invalid first argument type, expected FUNCTION or PATTERN, got " + success + " (in " + this.name + ")", line, char);
      }

      if (condition) {
        if (success && (success.kind === KINDS.PATTERN || success.kind === KINDS.FUNCTION)) {
          if (success._execute) {
            return success._execute([], context_stack, line, char);
          } else {
            return interpreter.call_raw(success, [], context_stack, {line, char});
          }
        } else return success;
      } else return prelude.symbols.__bail;
    }
  },
  "#else": {
    kind: KINDS.PATTERN,
    name: "#else",
    args: [
      {name: "action", optional: false}
    ],
    _execute: ([action], context_stack, line, char) => {
      let last_context = context_stack[context_stack.length - 1];
      if (last_context.last_value === prelude.symbols.__bail) {
        if (action && (action.kind === KINDS.PATTERN || action.kind === KINDS.FUNCTION)) {
          if (action._execute) {
            return action._execute([], context_stack, line, char);
          } else {
            return interpreter.call_raw(action, [], context_stack, {line, char});
          }
        }
      } else {
        return last_context.last_value;
      }
    }
  },
  "#elseif": {
    kind: KINDS.PATTERN,
    name: "#elseif",
    args: [
      {name: "condition", optional: false},
      {name: "action", optional: false}
    ],
    _execute: ([condition, action], context_stack, line, char) => {
      let last_context = context_stack[context_stack.length - 1];
      if (last_context.last_value === prelude.symbols.__bail) {
        if (!condition) return prelude.symbols.__bail;
        if (action && (action.kind === KINDS.PATTERN || action.kind === KINDS.FUNCTION)) {
          if (action._execute) {
            return action._execute([], context_stack, line, char);
          } else {
            return interpreter.call_raw(action, [], context_stack, {line, char});
          }
        }
      } else {
        return last_context.last_value;
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

      let last_value = prelude.symbols.__bail;
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
  "#while": {
    kind: KINDS.PATTERN,
    name: "#while",
    args: [
      {name: "condition"},
      {name: "loop", optional: true}
    ],
    _execute: ([condition, loop], context_stack, line, char) => {
      if (!condition || condition.kind !== KINDS.FUNCTION && condition.kind !== KINDS.PATTERN) {
        throw new RuntimeError("Invalid argument for #while: first argument should be a FUNCTION or PATTERN", line, char);
      }

      if (!loop && loop.kind !== KINDS.FUNCTION && loop.kind !== KINDS.PATTERN) {
        throw new RuntimeError("Invalid argument for #while: second argument should be a FUNCTION, PATTERN or absent", line, char);
      }

      let execute_condition;
      if (typeof condition._execute === "function") {
        execute_condition = function execute_condition() {
          return fn._execute([], context_stack, line, char);
        };
      } else {
        execute_condition = function execute_condition() {
          return interpreter.call_raw(condition, [], context_stack);
        };
      }

      let last_value = prelude.symbols.__bail;
      while (execute_condition()) {
        let result;
        if (loop) {
          if (loop._execute) {
            result = loop._execute([], context_stack, line, char);
          } else {
            result = interpreter.call_raw(loop, [], context_stack);
          }
          if (Array.isArray(result) && result[0] === prelude.symbols.__break) {
            return result[1] !== null ? result : last_value;
          }
          last_value = result;
        }
      }
      return last_value;
    }
  },
  "'ident": { // This will probably be deleted soon
    kind: KINDS.PATTERN,
    name: "'ident",
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
    name: "#break",
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
  "#bail": {
    kind: KINDS.PATTERN,
    name: "#bail",
    args: [],
    body: {
      instructions: [{
        kind: KINDS.SYMBOL,
        name: "__bail"
      }]
    }
  },
  "#error": {
    kind: KINDS.PATTERN,
    name: "#error",
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
  __break: Symbol("BREAK"),
  __bail: Symbol("BAIL")
};

prelude.structs = {};


const NUM_OPS = module.exports.NUM_OPS = {
  [KINDS.OP_ADD]: (a, b) => a + b,
  [KINDS.OP_MUL]: (a, b) => a * b,
  [KINDS.OP_SUB]: (a, b) => a - b,
  [KINDS.OP_DIV]: (a, b) => a / b,
  [KINDS.OP_MOD]: (a, b) => a % b,
  [KINDS.OP_AND]: (a, b) => a & b,
  [KINDS.OP_OR]: (a, b) => a | b,
  [KINDS.OP_NOT]: a => ~a,
  [KINDS.OP_EQ]: (a, b) => a === b,
  [KINDS.OP_NEQ]: (a, b) => a !== b,
  [KINDS.OP_LT]: (a, b) => a < b,
  [KINDS.OP_LTE]: (a, b) => a <= b,
  [KINDS.OP_GT]: (a, b) => a > b,
  [KINDS.OP_GTE]: (a, b) => a >= b
};

const BOOL_OPS = module.exports.BOOL_OPS = {
  [KINDS.OP_AND]: (a, b) => a && b,
  [KINDS.OP_OR]: (a, b) => a || b,
  [KINDS.OP_NOT]: a => !a,
  [KINDS.OP_EQ]: (a, b) => a === b,
  [KINDS.OP_NEQ]: (a, b) => a === b,
  [KINDS.OP_LT]: (a, b) => !a && b,
  [KINDS.OP_LTE]: (a, b) => !a || b,
  [KINDS.OP_GT]: (a, b) => a && !b,
  [KINDS.OP_GTE]: (a, b) => a || !b
};

const STR_OPS = module.exports.STR_OPS = {
  [KINDS.OP_ADD]: (a, b) => a + b,
  [KINDS.OP_MUL]: (a, b) => {
    if (typeof b === "number") {
      return a.repeat(b);
    } else {
      throw new RuntimeError("Cannot multiply string with a number");
    }
  },
  [KINDS.OP_EQ]: (a, b) => a === b,
  [KINDS.OP_NEQ]: (a, b) => a !== b
};

const ANY_OPS = module.exports.ANY_OPS = {
  [KINDS.OP_EQ]: (a, b) => a === b,
  [KINDS.OP_NEQ]: (a, b) => a !== b
}
