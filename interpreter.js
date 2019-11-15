const KINDS = require("./kinds.js");
const {BINARY_OPS, UNARY_OPS, VALID_EXP_TERMS} = KINDS;
const {RuntimeError} = require("./errors.js");

const interpreter = module.exports = function interpreter(branch, stack) {

  // console.log(JSON.stringify(branch, " ", 2));
  let context_stack = [...stack, {patterns: {}, symbols: {}, last_value: null}];
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

function find_pattern_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].patterns.hasOwnProperty(name)) {
      return context_stack[n].patterns[name];
    }
  }
  return null;
}

function find_symbol_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].symbols.hasOwnProperty(name)) {
      return context_stack[n].symbols[name];
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

const EXECUTORS = {};

const call_pattern = EXECUTORS[KINDS.PATTERN_CALL] = function call_pattern(instruction, context_stack, next_instructions) {
  let pattern = find_pattern_in_stack(instruction.pattern.name, context_stack);

  if (pattern) {
    if (typeof pattern._execute === "function") {
      let args = interprete_instruction(instruction.args, context_stack, next_instructions);
      // console.log("!>", args);
      let result = pattern._execute(args, context_stack);
      return result;
    } else {
      let args = interprete_instruction(instruction.args, context_stack, next_instructions);
      // console.log("!>", args);
      let new_ctx = {
        symbols: {},
        patterns: {}
      };

      for (let n = 0; n < pattern.args.length; n++) {
        new_ctx.symbols[pattern.args[n].name] = args[n];
      }

      let result = interpreter(pattern.body, [...context_stack, new_ctx]);
      return result;
    }
  } else {
    throw new RuntimeError(`Pattern not found: ${instruction.pattern.name}`, instruction.line, instruction.char);
  }
};

EXECUTORS[KINDS.NUMBER] = (instruction) => instruction.number;

EXECUTORS[KINDS.STRING] = (instruction) => instruction.string;

EXECUTORS[KINDS.FUNCTION] = (instruction) => instruction;

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

EXECUTORS[KINDS.DEFINE_SYMBOL] = function set_symbol(instruction, context_stack) {
  for (let o = context_stack.length - 1; o >= 0; o--) {
    if (context_stack[o].symbols.hasOwnProperty(instruction.left)) {
      context_stack[o].symbols[instruction.left] = interprete_instruction(instruction.right, context_stack, next_instructions);
      break;
    }
  }
};

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
      }
    } else if (typeof step === "symbol" && BINARY_OPS.includes(step)) {
      if (typeof stack[stack.length - 2] === "number") {
        let b = stack.pop();
        if (Array.isArray(b) && b.length === 1) {
          b = b[0];
        }
        let a = stack.pop();
        stack.push(NUM_OPS[step](a, b));
      } else if (typeof stack[stack.length - 2] === "boolean") {
        if (BOOL_OPS.hasOwnProperty(step)) {
          let b = stack.pop();
          if (Array.isArray(b) && b.length === 1) {
            b = b[0];
          }
          let a = stack.pop();
          stack.push(BOOL_OPS[step](a, b));
        } else {
          throw new RuntimeError("<bool> has no " + step.description + " method");
        }
      } else if (typeof stack[stack.length - 2] === "string") {
        if (STR_OPS.hasOwnProperty(step)) {
          let b = stack.pop();
          if (Array.isArray(b) && b.length === 1) {
            b = b[0];
          }
          let a = stack.pop();
          stack.push(STR_OPS[step](a, b));
        }
      }
    } else if (typeof step === "symbol" && UNARY_OPS.includes(step)) {
      if (typeof stack[stack.length - 1] === "number") {
        stack.push(NUM_OPS[step](stack.pop()));
      } else if (typeof stack[stack.length - 1] === "boolean") {
        if (BOOL_OPS.hasOwnProperty(step)) {
          stack.push(BOOL_OPS[step](stack.pop()));
        } else {
          throw new RuntimeError("<bool> has no " + step.description + " method");
        }
      } else if (typeof stack[stack.length - 1] === "string") {
        if (STR_OPS.hasOwnProperty(step)) {
          stack.push(STR_OPS[step](stack.pop()));
        } else {
          throw new RuntimeError("<bool> has no " + step.description + " method");
        }
      }
    } else {
      throw new Error("Unimplemented");
    }
  }
  return stack[0];
}

const NUM_OPS = {
  [KINDS.OP_ADD]: (a, b) => a + b,
  [KINDS.OP_MUL]: (a, b) => a * b,
  [KINDS.OP_SUB]: (a, b) => a - b,
  [KINDS.OP_DIV]: (a, b) => a / b,
  [KINDS.OP_AND]: (a, b) => a & b,
  [KINDS.OP_OR]: (a, b) => a | b,
  [KINDS.OP_NOT]: a => ~a
};

const BOOL_OPS = {
  [KINDS.OP_AND]: (a, b) => a && b,
  [KINDS.OP_OR]: (a, b) => a || b,
  [KINDS.OP_NOT]: a => !a
};

const STR_OPS = {
  [KINDS.OP_ADD]: (a, b) => a + b,
  [KINDS.OP_MUL]: (a, b) => {
    if (typeof b === "number") {
      return a.repeat(b);
    } else {
      throw new RuntimeError("Cannot multiply string with a number");
    }
  }
}
