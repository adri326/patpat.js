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
  [KINDS.OP_GTE]: (a, b) => a >= b,

  "'sqrt": define_method("'sqrt", 1, ([x]) => x < 0 ? 0 : Math.sqrt(x)),
  "'abs": define_method("'abs", 1, ([x]) => Math.abs(x)),
  "'pow": define_method("'pow", 2, ([x, y]) => {
    let res = Math.pow(x, y);
    if (isNaN(res)) return 0;
    return res;
  }),
  "'round": define_method("'round", 1, ([x]) => Math.round(x)),
  "'floor": define_method("'floor", 1, ([x]) => Math.floor(x)),
  "'ceil": define_method("'ceil", 1, ([x]) => Math.ceil(x)),
  "'log": define_method("'log", 1, ([x]) => Math.log(x)),
  "'exp": define_method("'exp", 1, ([x]) => Math.exp(x)),
  "'cos": define_method("'cos", 1, ([x]) => Math.cos(x)),

  "'sin": define_method("'sin", 1, ([x]) => Math.sin(x)),
  "'tan": define_method("'tan", 1, ([x]) => {
    let res = Math.tan(x);
    if (isNaN(res)) return 0;
    return res;
  }),
  "'cosh": define_method("'cosh", 1, ([x]) => Math.cosh(x)),
  "'sinh": define_method("'sinh", 1, ([x]) => Math.sinh(x)),
  "'tanh": define_method("'tanh", 1, ([x]) => Math.tanh(x)),

  "'asin": define_method("'asin", 1, ([x]) => x >= -1 && x <= 1 ? Math.asin(x) : 0),
  "'acos": define_method("'acos", 1, ([x]) => x >= -1 && x <= 1 ? Math.acos(x) : 0),
  "'atan": define_method("'atan", 1, ([x]) => Math.atan(x)),
  "'asinh": define_method("'asinh", 1, ([x]) => Math.asinh(x)),
  "'acosh": define_method("'acosh", 1, ([x]) => x > 0 ? Math.acosh(x) : 0),
  "'atanh": define_method("'atanh", 1, ([x]) => x > -1 && x < 1 ? Math.atanh(x) : 0),

  "'string": define_method("'string", 1, ([x]) => x.toString())
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
  [KINDS.OP_GTE]: (a, b) => a || !b,

  "'string": define_method("'string", 1, ([x]) => x.toString())
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
  [KINDS.OP_NEQ]: (a, b) => a !== b,

  "'string": define_method("'string", 1, ([x]) => x.toString()),
  "'length": define_method("'length", 1, ([x]) => x.length),
  "'to_lower": define_method("'to_lower", 1, ([x]) => x.toLowerCase()),
  "'to_upper": define_method("'to_upper", 1, ([x]) => x.toUpperCase()),
  "'includes": define_method("'includes", 2, ([x, y]) => x.includes(y)),
  "'slice": {
    kind: KINDS.PATTERN,
    name: "'slice",
    args: [
      {name: "string", optional: false},
      {name: "from", optional: true},
      {name: "to", optional: true}
    ],
    _execute: ([string, from = 0, to = 0]) => string.slice(from, to)
  },
  "'char_at": define_method("'char_at", 2, ([x, y]) => x.charCodeAt(y) || 0)
};

const ANY_OPS = module.exports.ANY_OPS = {
  [KINDS.OP_EQ]: (a, b) => a === b,
  [KINDS.OP_NEQ]: (a, b) => a !== b,

  "'string": define_method("'string", 1, ([x]) => x.toString())
}

function define_method(name, n_args, fn) {
  return {
    kind: KINDS.PATTERN,
    name,
    args: new Array(n_args).map((_, i) => ({
      name: ["x", "y", "z"][i] || ("n_" + i),
      optional: false
    })),
    _execute: fn
  };
}
