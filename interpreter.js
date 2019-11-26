const KINDS = require("./kinds.js");
const {BINARY_OPS, UNARY_OPS, VALID_EXP_TERMS} = KINDS;
const {RuntimeError} = require("./errors.js");
const prelude = require("./prelude.js");

const EXECUTORS = {};

const interpreter = module.exports = function interpreter(branch, stack) {
  // console.log(JSON.stringify(branch, " ", 2));
  let context_stack = [...stack, {patterns: {}, symbols: {}, structs: {}, last_value: null}];
  let last_context = context_stack[context_stack.length - 1];
  for (let instruction of branch.instructions) {
    if (instruction.kind === KINDS.DEFINE_PATTERN) {
      last_context.patterns[instruction.name] = instruction;
    }
  }
  for (let n = 0; n < branch.instructions.length; n++) {

    let result = interprete_instruction(branch.instructions[n], context_stack, branch.instructions.slice(n+1));
    last_context.last_value = result;
  }

  return last_context.last_value;
}

const find_pattern_in_stack = module.exports.find_pattern_in_stack = function find_pattern_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].patterns.hasOwnProperty(name)) {
      return context_stack[n].patterns[name];
    }
  }
  return null;
}

const find_symbol_in_stack = module.exports.find_symbol_in_stack = function find_symbol_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].symbols.hasOwnProperty(name)) {
      return context_stack[n].symbols[name];
    }
  }
  return null;
}

const find_struct_in_stack = module.exports.find_struct_in_stack = function find_struct_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].structs.hasOwnProperty(name)) {
      return context_stack[n].structs[name];
    }
  }
  return null;
}

function interprete_instruction(instruction, context_stack, next_instructions) {
  let last_context = context_stack[context_stack.length - 1];

  if (EXECUTORS.hasOwnProperty(instruction.kind)) {
    return EXECUTORS[instruction.kind](instruction, context_stack, next_instructions);
  }
}

const call_pattern = EXECUTORS[KINDS.PATTERN_CALL] = function call_pattern(instruction, context_stack, next_instructions) {
  let pattern = find_pattern_in_stack(instruction.pattern.name, context_stack);

  if (pattern) {
    let args = interprete_instruction(instruction.args, context_stack, next_instructions);
    // console.log(pattern);
    // if (pattern.args) console.log(pattern.args.filter(x => !x.optional).length, args);
    if (pattern.args && args.length < pattern.args.filter(x => !x.optional).length) {
      throw new RuntimeError("Not enough argument given to " + pattern.name + ", did you use ';'?", instruction.line, instruction.char);
    }

    // console.log("!>", args);

    if (typeof pattern._execute === "function") {
      return pattern._execute(args, context_stack, instruction.line, instruction.char);
    } else {
      return call_raw(pattern, args, context_stack);
    }
  } else {
    throw new RuntimeError(`Pattern not found: ${instruction.pattern.name}`, instruction.line, instruction.char);
  }
};

const call_function = EXECUTORS[KINDS.FUNCTION_CALL] = function call_function(instruction, context_stack, next_instructions) {
  let fn = interprete_instruction(instruction.fn, context_stack, next_instructions);
  if (Array.isArray(fn) && fn.length === 1) fn = fn[0];

  if (fn.kind !== KINDS.FUNCTION) {
    throw new RuntimeError("Left-hand-side call value is not a function", instruction.line, instruction.char);
  }

  let args = interprete_instruction(instruction.args, context_stack, next_instructions);

  return call_raw(fn, args, context_stack);
}

const call_raw = module.exports.call_raw = function call_raw(fn, args, context_stack) {
  let new_ctx = {
    symbols: {},
    patterns: {},
    structs: {},
    last_value: null
  };

  for (let n = 0; n < fn.args.length; n++) {
    new_ctx.symbols[fn.args[n].name] = args[n];
  }

  return interpreter(fn.body, [...(fn.context_stack || context_stack), new_ctx]);
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

EXECUTORS[KINDS.SYMBOL] = function get_symbol(instruction, context_stack, next_instructions) {
  let symbol = find_symbol_in_stack(instruction.name, context_stack);
  if (symbol !== null) {
    return symbol;
  } else {
    throw new RuntimeError("Undefined variable: " + instruction.name, instruction.line, instruction.char);
  }
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

EXECUTORS[KINDS.DEFINE_SYMBOL] = function set_symbol(instruction, context_stack, next_instructions) {
  for (let o = context_stack.length - 1; o >= 0; o--) {
    if (context_stack[o].symbols.hasOwnProperty(instruction.left.name)) {
      let old_value = context_stack[o].symbols[instruction.left.name];
      context_stack[o].symbols[instruction.left.name] = interprete_instruction(instruction.right, context_stack, next_instructions);
      return old_value;
    }
  }
  throw new RuntimeError(
    "No definition of " + instruction.left.name + " found",
    instruction.line,
    instruction.char
  );
};

EXECUTORS[KINDS.DECLARE_SYMBOL] = function declare_symbol(instruction, context_stack, next_instructions) {
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
    last_context.symbols[instruction.name] = interprete_instruction(instruction.right, context_stack, next_instructions);
  }
}

EXECUTORS[KINDS.STRUCT] = function declare_struct(instruction, context_stack, next_instructions) {
  let last_context = context_stack[context_stack.length - 1];
  last_context.structs[instruction.name] = instruction;
}

EXECUTORS[KINDS.STRUCT_INIT] = function init_struct(instruction, context_stack, next_instructions) {
  let struct = find_struct_in_stack(instruction.name, context_stack);
  if (!struct) {
    throw new RuntimeError("No struct named " + instruction.name + " found.", instruction.line, instruction.char);
  }

  let pattern = find_pattern_in_stack(instruction.pattern, [struct]);
  if (!pattern) {
    throw new RuntimeError(`No pattern named ${instruction.pattern} found in ${instruction.name}/`, instruction.line, instruction.char);
  }

  let instance = {
    kind: KINDS.STRUCT_INSTANCE,
    parent: struct,
    symbols: {}
  };

  for (let symbol in struct.symbols) {
    instance.symbols[symbol] = struct.symbols[symbol].right;
  }

  let args = interprete_instruction(instruction.args, context_stack, next_instructions);
  let new_ctx = [...context_stack, {
    symbols: {
      self: {...instance, patterns: struct.patterns, structs: {}}
    },
    patterns: {},
    structs: {}
  }];

  call_raw(pattern, instruction.args, new_ctx);

  return instance;
}

EXECUTORS[KINDS.DEFINE_MEMBER] = function define_member(instruction, context_stack, next_instructions) {
  let parent = find_symbol_in_stack(instruction.parent.name, context_stack);
  if (parent.kind !== KINDS.STRUCT_INSTANCE) {
    throw new RuntimeError("Cannot access member of " + parent.kind.description, instruction.parent.line, instruction.parent.char);
  }

  if (!parent.symbols.hasOwnProperty(instruction.member.name)) {
    throw new RuntimeError("Variable not found in " + instruction.parent.name, instruction.member.line, instruction.member.char);
  }

  let old_value = parent.symbols[instruction.member.name];

  parent.symbols[instruction.member.name] = interprete_instruction(instruction.right, context_stack, next_instructions);

  return old_value;
}

const member_access = EXECUTORS[KINDS.MEMBER_ACCESSOR] = function member_access(instruction, context_stack, next_instructions) {
  // struct instance
  let instance = find_symbol_in_stack(instruction.parent.name, context_stack);
  if (!instance) { // if the instance isn't defined
    console.log(context_stack);
    throw new RuntimeError("Variable not found", instruction.line, instruction.char);
  }
  if (instance.kind !== KINDS.STRUCT_INSTANCE) { // if the instance isn't a struct
    throw new RuntimeError("Cannot access member of " + parent.kind.description, instruction.parent.line, instruction.parent.char);
  }

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

      let args = interprete_instruction(instruction.member.args, context_stack, next_instructions);
      let result = call_raw(pattern, [instance, ...args], context_stack);
      
      return result;
  }
}

const execute_expression = EXECUTORS[KINDS.EXPRESSION] = function execute_expression(instruction, context_stack, next_instructions) {
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
          stack.push(interprete_instruction(step, context_stack, next_instructions));
          break;
        case KINDS.PATTERN_CALL:
          stack.push(call_pattern(step, context_stack, next_instructions));
          break;
        case KINDS.FUNCTION_CALL:
          throw new Error("Unimplemented");
          break;
        case KINDS.SYMBOL:
          let symbol = find_symbol_in_stack(step.name, context_stack);
          if (symbol === null) throw new RuntimeError("Undefined variable " + step.name, step.line, step.char);
          stack.push(symbol);
          break;
        case KINDS.MEMBER_ACCESSOR:
          let value = member_access(step, context_stack, next_instructions);
          stack.push(value);
          break;
      }
    } else if (typeof step === "symbol") {
      let operators;
      let type_name;
      let lhs = BINARY_OPS.includes(step) ? stack[stack.length - 2] : stack[stack.length - 1];

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
        default:
          throw new RuntimeError("Unimplemented: " + typeof lhs, instruction.line, instruction.char);
      }

      if (typeof operators[step] !== "function") {
        throw new RuntimeError(`No (or invalid) operator '${step.description}' defined for ${type_name}`);
      }

      if (BINARY_OPS.includes(step)) { // If the operator is a binary operator, like + or ==
        let b = stack.pop();
        let a = stack.pop();
        let result = operators[step](a, b);

        if (Array.isArray(result) && result.length === 1) result = result[0];
        stack.push(result);
      } else if (UNARY_OPS.includes(step)) { // If the operator is a unary operator, like !
        let result = operators[step](stack.pop());

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
