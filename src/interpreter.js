const KINDS = require("./kinds.js");
const {BINARY_OPS, UNARY_OPS, VALID_EXP_TERMS} = KINDS;
const {RuntimeError} = require("./errors.js");
const prelude = require("./prelude.js");
const Context = require("./context.js");
const path = require("path");

const EXECUTORS = {};

const interpreter = module.exports.interprete = function interpreter(branch, stack = [], return_ctx = false) {
  // console.log(JSON.stringify(branch, " ", 2));
  let new_stack = new Context().tail(stack);
  let last_context = new_stack[new_stack.length - 1];

  // NOTE: Patterns are read ahead
  for (let instruction of branch.instructions) {
    if (instruction.kind === KINDS.DEFINE_PATTERN) {
      if (instruction.name.startsWith("#")) {
        throw new CompileError("Patterns starting with # in non-structs are reserved to the compiler. Please use ' instead.", instruction.line, instruction.char);
      }
      instruction.declaration_context = new_stack; // used to resolve argument types
      last_context.patterns[instruction.name] = instruction;
    } else if (instruction.kind === KINDS.STRUCT) {
      last_context.structs[instruction.name] = instruction;
    }
  }

  for (let n = 0; n < branch.instructions.length; n++) {
    let result = interprete_instruction(branch.instructions[n], new_stack);
    last_context.last_value = result;
  }

  if (return_ctx) {
    return last_context;
  }
  return last_context.last_value;
}

EXECUTORS[KINDS.BLOCK] = interpreter;

const find_pattern_in_stack = module.exports.find_pattern_in_stack = function find_pattern_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].patterns.hasOwnProperty(name)) {
      return context_stack[n].patterns[name];
    }
  }
  return KINDS.NOT_FOUND;
}

const find_symbol_in_stack = module.exports.find_symbol_in_stack = function find_symbol_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].symbols.hasOwnProperty(name)) {
      return context_stack[n].symbols[name];
    }
  }
  return KINDS.NOT_FOUND;
}

const find_struct_in_stack = module.exports.find_struct_in_stack = function find_struct_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].structs.hasOwnProperty(name)) {
      return context_stack[n].structs[name];
    }
  }
  return KINDS.NOT_FOUND;
}

const interprete_instruction = module.exports.interprete_instruction = function interprete_instruction(instruction, context_stack, collapse_tuples = false) {
  let last_context = context_stack[context_stack.length - 1];

  if (EXECUTORS.hasOwnProperty(instruction.kind)) {
    let result = EXECUTORS[instruction.kind](instruction, context_stack);
    if (collapse_tuples && Array.isArray(result) && result.length === 1) {
      result = result[0];
    }
    return result;
  }
}

const call_pattern = EXECUTORS[KINDS.PATTERN_CALL] = function call_pattern(instruction, context_stack) {
  let pattern = find_pattern_in_stack(instruction.pattern.name, context_stack);

  if (pattern == KINDS.NOT_FOUND) {
    throw new RuntimeError(`Pattern not found: ${instruction.pattern.name}`, instruction.line, instruction.char);
  }
  let args = interprete_instruction(instruction.args, context_stack);
  // console.log(pattern);
  // if (pattern.args) console.log(pattern.args.filter(x => !x.optional).length, args);
  // if (pattern.args && args.length < pattern.args.filter(x => !x.optional).length) {
  //   throw new RuntimeError("Not enough argument given to " + pattern.name + ", did you use ';'?", instruction.line, instruction.char);
  // }

  // console.log("!>", args);

  if (typeof pattern._execute === "function") {
    return pattern._execute(args, context_stack, instruction.line, instruction.char);
  } else {
    return call_raw(pattern, args, context_stack, instruction);
  }
};

const call_function = EXECUTORS[KINDS.FUNCTION_CALL] = function call_function(instruction, context_stack) {
  let fn = interprete_instruction(instruction.fn, context_stack);
  if (Array.isArray(fn) && fn.length === 1) fn = fn[0];

  if (fn.kind !== KINDS.FUNCTION) {
    throw new RuntimeError("Left-hand-side call value is not a function", instruction.line, instruction.char);
  }

  let args = interprete_instruction(instruction.args, context_stack);

  return call_raw(fn, args, context_stack, instruction);
}

const call_raw = module.exports.call_raw = function call_raw(fn, args, context_stack, instruction, options = {}) {
  let new_ctx = new Context();

  let n_args = distribute_args(args, fn.args, context_stack, {
    instance: null,
    ...options,
    instruction
  });

  for (let n = 0; n < fn.args.length; n++) {
    new_ctx.symbols[fn.args[n].name] = n_args[n];
  }

  if (fn.kind !== KINDS.DEFINE_PATTERN && fn.types.filter(x => x !== null).length > 0) {
    throw new RuntimeError("Only patterns may have argument types.", fn.line, fn.char);
  } else if (fn.types.filter(x => x !== null).length > 0) {
    function wrong_type(expected, n) {
      let got = typeof n_args[n] === "object" ? n_args[n].parent.name : typeof n_args[n];
      throw new RuntimeError(
        `Invalid argument type for ${fn.name}[${n}]; expected <${expected}>, got <${got}>.`,
        instruction.line, instruction.char, instruction.file
      );
    }
    let n = -1;
    for (let type of fn.types) {
      n++;
      if (type === null) continue;
      if (type.name === "number" && typeof n_args[n] !== "number") {
        wrong_type("number", n);
      } else if (type.name === "bool" && typeof n_args[n] !== "boolean") {
        wrong_type("bool", n);
      } else if (type.name === "string" && typeof n_args[n] !== "string") {
        wrong_type("string", n);
      } else if (type.name === "function" && n_args[n].kind !== KINDS.FUNCTION) {
        wrong_type("function", n);
      } else {
        let struct = find_struct_in_stack(type.name, fn.declaration_context);
        if (struct === KINDS.NOT_FOUND) {
          throw new RuntimeError("No struct named " + type.name + " found!", instruction.line, instruction.char, instruction.file);
        }
        if (n_args[n].parent !== struct) {
          wrong_type(type.name, n);
        }
      }
    }
  }

  // if (instruction && fn.args && args.length < fn.args.filter(x => !x.optional).length) {
  //   throw new RuntimeError("Not enough argument given to " + fn.name + ", did you use ';'?", instruction.line, instruction.char);
  // }

  return interpreter(fn.body, new_ctx.tail(fn.context_stack || context_stack));
}

EXECUTORS[KINDS.NUMBER] = (instruction) => instruction.number;

EXECUTORS[KINDS.STRING] = (instruction) => instruction.string;

EXECUTORS[KINDS.BOOLEAN] = (instruction) => instruction.state;

EXECUTORS[KINDS.FUNCTION] = (instruction) => instruction;

EXECUTORS[KINDS.PATTERN] = (instruction, context_stack) => {
  let pattern = find_pattern_in_stack(instruction.name, context_stack);
  if (!pattern) {
    throw new RuntimeError("Pattern not found: " + instruction.name, instruction.line, instruction.char);
  }
  return pattern;
};

EXECUTORS[KINDS.SYMBOL] = function get_symbol(instruction, context_stack) {
  let symbol = find_symbol_in_stack(instruction.name, context_stack);
  if (symbol === KINDS.NOT_FOUND) {
    throw new RuntimeError("Undefined variable: " + instruction.name, instruction.line, instruction.char);
  }
  return symbol;
};

EXECUTORS[KINDS.TUPLE] = function tuple(instruction, context_stack) {
  let elements = [];
  let n_element = 0;
  for (let sub_instruction of instruction.instructions) {
    if (sub_instruction.kind === KINDS.NEXT_ELEMENT) {
      n_element++;
    } else {
      elements[n_element] = interprete_instruction(sub_instruction, context_stack);
    }
  }
  return elements;
};

EXECUTORS[KINDS.DEFINE_SYMBOL] = function set_symbol(instruction, context_stack) {
  for (let o = context_stack.length - 1; o >= 0; o--) {
    if (context_stack[o].symbols.hasOwnProperty(instruction.left.name)) {
      let old_value = context_stack[o].symbols[instruction.left.name];
      context_stack[o].symbols[instruction.left.name] = interprete_instruction(instruction.right, context_stack);
      return old_value;
    }
  }
  throw new RuntimeError(
    "No definition of " + instruction.left.name + " found",
    instruction.line,
    instruction.char
  );
};

EXECUTORS[KINDS.DECLARE_SYMBOL] = function declare_symbol(instruction, context_stack) {
  let last_context = context_stack[context_stack.length - 1];
  if (last_context.symbols.hasOwnProperty(instruction.name)) {
    throw new RuntimeError(
      "Duplicate declaration of " + instruction.name,
      instruction.line,
      instruction.char
    );
  }
  if (instruction.right === null) {
    last_context.symbols[instruction.name] = null;
  } else {
    last_context.symbols[instruction.name] = interprete_instruction(instruction.right, context_stack);
  }
}

EXECUTORS[KINDS.STRUCT_INIT] = function init_struct(instruction, context_stack) {
  let struct = find_struct_in_stack(instruction.name, context_stack);
  if (struct === KINDS.NOT_FOUND) {
    throw new RuntimeError("No struct named " + instruction.name + " found.", instruction.line, instruction.char);
  }

  let pattern = find_pattern_in_stack(instruction.pattern, [struct]);
  if (pattern === KINDS.NOT_FOUND) {
    throw new RuntimeError(`No pattern named ${instruction.pattern.name} found in ${instruction.name}.`, instruction.line, instruction.char);
  }

  if (pattern.is_method) {
    throw new RuntimeError(`Pattern ${instruction.pattern.name} is not a constructor.`, instruction.line, instruction.char);
  }

  let instance = struct.instance();

  let args = interprete_instruction(instruction.args, context_stack);

  let new_ctx = new Context({
    self: {...instance, patterns: struct.patterns, structs: {}}
  });

  call_raw(pattern, args, new_ctx.tail(context_stack), instruction);

  return instance;
}

EXECUTORS[KINDS.DEFINE_MEMBER] = function define_member(instruction, context_stack) {
  let instance = find_symbol_in_stack(instruction.parent.name, context_stack);
  if (!instance) {
    throw new RuntimeError("Variable not found: " + instruction.parent.name, instruction.parent.line, instruction.parent.char);
  } else if (instance.kind !== KINDS.STRUCT_INSTANCE) {
    throw new RuntimeError("Cannot access member of " + parent.kind.description, instruction.parent.line, instruction.parent.char);
  }

  if (!instance.symbols.hasOwnProperty(instruction.member.name)) {
    throw new RuntimeError("Variable not found in " + instruction.parent.name, instruction.member.line, instruction.member.char);
  }

  let old_value = instance.symbols[instruction.member.name];

  instance.symbols[instruction.member.name] = interprete_instruction(instruction.right, context_stack);

  return old_value;
}

const member_access = EXECUTORS[KINDS.MEMBER_ACCESSOR] = function member_access(instruction, context_stack) {
  // struct instance
  let instance;

  if (typeof instruction.parent.kind === KINDS.SYMBOL) {
    instance = find_symbol_in_stack(instruction.parent.name, context_stack);
  } else {
    instance = interprete_instruction(instruction.parent, context_stack, true);
  }

  if (!instance) { // if the instance isn't defined
    throw new RuntimeError("Variable not found", instruction.line, instruction.char);
  }
  if (instance.kind !== KINDS.STRUCT_INSTANCE && instance.kind !== KINDS.MODULE) { // if the instance isn't a struct or module
    throw new RuntimeError("Cannot access member of " + instruction.parent.kind.description, instruction.parent.line, instruction.parent.char);
  }

  if (instance.kind === KINDS.STRUCT_INSTANCE) {
    switch (instruction.member.kind) {
      case KINDS.SYMBOL:
        if (!instance.symbols.hasOwnProperty(instruction.member.name)) { // if the symbol is not found
          throw new RuntimeError("Variable not found in " + instruction.parent.name, instruction.member.line, instruction.member.char);
        }

        return instance.symbols[instruction.member.name];
      case KINDS.PATTERN_CALL:
        let pattern = instance.parent.patterns[instruction.member.pattern.name];
        if (!pattern) { // if the pattern is not found
          throw new RuntimeError("Pattern not found in " + instruction.parent.name, instruction.member.line, instruction.member.char);
        }
        if (!pattern.is_method) {
          throw new RuntimeError("Pattern is not a method", instruction.member.line, instruction.member.char);
        }

        let args = interprete_instruction(instruction.member.args, context_stack);
        let result = call_raw(pattern, args, context_stack, instruction, {instance});

        return result;
    }
  } else if (instance.kind === KINDS.MODULE) {
    switch (instruction.member.kind) {
      case KINDS.SYMBOL:
        if (!instance.symbols.hasOwnProperty(instruction.member.name)) { // if the symbol is not found
          throw new RuntimeError("Variable not found in " + path.basename(instance.path), instruction.member.line, instruction.member.char);
        }

        return instance.symbols[instruction.member.name];
      case KINDS.PATTERN_CALL:
        if (!instance.patterns.hasOwnProperty(instruction.member.pattern.name)) { // if the pattern is not found
          throw new RuntimeError("Pattern not found in " + path.basename(instance.path), instruction.member.line, instruction.member.char);
        }

        // This is as to feed to it what the last value is
        let fake_context = new Context({}, {}, {}, context_stack[context_stack.length - 1].last_value);

        return call_pattern(instruction.member, fake_context.tail(instance.context_stack));
      // TODO: structs
    }
  }
}

const execute_expression = EXECUTORS[KINDS.EXPRESSION] = function execute_expression(instruction, context_stack) {
  let stack = [];

  for (let step of instruction.steps) {
    if (typeof step === "object") {
      switch (step.kind) {
        case KINDS.NUMBER:
          stack.push(step.number);
          break;
        case KINDS.STRING:
          stack.push(step.string);
          break;
        case KINDS.BOOLEAN:
          stack.push(step.state);
          break;
        case KINDS.TUPLE:
          stack.push(interprete_instruction(step, context_stack));
          break;
        case KINDS.PATTERN_CALL:
          stack.push(call_pattern(step, context_stack));
          break;
        case KINDS.FUNCTION_CALL:
          throw new Error("Unimplemented");
          break;
        case KINDS.SYMBOL:
          let symbol = find_symbol_in_stack(step.name, context_stack);
          if (symbol === KINDS.NOT_FOUND) throw new RuntimeError("Undefined variable " + step.name, step.line, step.char);
          stack.push(symbol);
          break;
        case KINDS.MEMBER_ACCESSOR:
          let value = member_access(step, context_stack);
          stack.push(value);
          break;
      }
    } else if (typeof step === "symbol") {
      let operators;
      let type_name;
      let lhs = BINARY_OPS.includes(step) ? stack[stack.length - 2] : stack[stack.length - 1];
      if (Array.isArray(lhs) && lhs.length === 1) lhs = lhs[0];

      switch (typeof lhs) {
        case "number":
          operators = prelude.NUM_OPS;
          type_name = "<number>";
          break;
        case "boolean":
          operators = prelude.BOOL_OPS;
          type_name = "<bool>";
          break;
        case "string":
          operators = prelude.STR_OPS;
          type_name = "<string>";
          break;
        case "object":
          if (lhs && lhs.kind === KINDS.STRUCT_INSTANCE) {
            operators = lhs.parent.operators;
            type_name = lhs.parent.name;
            break;
          }
          // fallthrough
        default:
          operators = prelude.ANY_OPS;
          type_name = "<undefined>";
      }

      if (typeof operators[step] !== "function") {
        throw new RuntimeError(`No (or invalid) operator '${step.description}' defined for ${type_name}`);
      }

      if (BINARY_OPS.includes(step)) { // If the operator is a binary operator, like + or ==
        let b = stack.pop();
        let a = stack.pop();
        let new_stack = context_stack;
        if (a && a.kind === KINDS.STRUCT_INSTANCE) {
          // console.log(a);
          new_stack = a.to_context().tail(context_stack);
        }
        let result = operators[step](a, b, new_stack, step);

        if (Array.isArray(result) && result.length === 1) result = result[0];
        stack.push(result);
      } else if (UNARY_OPS.includes(step)) { // If the operator is a unary operator, like !
        let a = stack.pop();
        let new_stack = context_stack;

        if (a && a.kind === KINDS.STRUCT_INSTANCE) {
          new_stack = a.to_context().tail(context_stack);
        }

        let result = operators[step](a, null, new_stack);

        if (Array.isArray(result) && result.length === 1) result = result[0];
        stack.push(result);
      } else {
        throw new RuntimeError(`Operator ${step.description} is neither a binary, nor a unary operator.`, instruction.line, instruction.char);
      }
    } else {
      throw new Error("Unimplemented");
    }
  }
  return stack[0];
}

EXECUTORS[KINDS.USE] = function use(instruction, context_stack) {
  // console.log("=== NOW ENTERING " + instruction.path + " ===");
  let ctx = interpreter(prelude.sourced[instruction.path], context_stack, true);
  return {
    kind: KINDS.MODULE,
    symbols: ctx.symbols,
    patterns: ctx.patterns,
    structs: ctx.struct,
    context_stack: ctx.tail(context_stack),
    path: instruction.path
  };
}

EXECUTORS[KINDS.LOAD] = function load(instruction, context_stack) {
  let ctx = new Context();
  for (let i of prelude.sourced[instruction.path].instructions) {
    if (i.kind === KINDS.DEFINE_PATTERN) {
      if (i.name.startsWith("#")) {
        throw new CompileError("Patterns starting with # in non-structs are reserved to the compiler. Please use ' instead.", i.line, i.char);
      }
      ctx.patterns[i.name] = i;
    } else if (i.kind === KINDS.STRUCT) {
      ctx.structs[i.name] = i;
    }
  }
  return {
    kind: KINDS.MODULE,
    symbols: {},
    patterns: ctx.patterns,
    structs: ctx.structs,
    path: instruction.path,
    context_stack: ctx.tail(context_stack)
  };
}

function distribute_args(args, raw_args, context_stack, options) {
  let instance = options.instance || null;
  let instruction = options.instruction;
  let n = 0;
  let res = [];
  for (let arg of raw_args) {
    if (arg.kind === KINDS.SELF) {
      res.push(instance);
    } else if (arg.kind === KINDS.LHS) {
      res.push(context_stack[context_stack.length - 1].last_value);
    } else {
      if (n >= args.length) {
        if (instruction) {
          throw new RuntimeError("Not enough arguments", instruction.line, instruction.char);
        } else {
          throw new RuntimeError("Not enough arguments");
        }
      }
      res.push(args[n++]);
    }
  }
  return res;
}
