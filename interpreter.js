const KINDS = require("./kinds.js");
const {RuntimeError} = require("./errors.js");

const interpreter = module.exports = function interpreter(branch, stack) {

  // console.log(JSON.stringify(branch, " ", 2));
  let context_stack = [...stack, {patterns: {}, symbols: {}, last_value: null}];
  let last_context = context_stack[context_stack.length - 1];
  for (let n = 0; n < branch.instructions.length; n++) {

    let result = interprete_instruction(branch.instructions[n], context_stack, branch.instructions.slice(n+1));
    last_context.last_value = result;
  }

  return last_context.last_value;
}

function find_pattern_in_stack(name, context_stack) {
  for (let n = context_stack.length - 1; n >= 0; n--) {
    if (context_stack[n].patterns[name]) {
      return context_stack[n].patterns[name];
    }
  }
  return null;
}

function interprete_instruction(instruction, context_stack, next_instructions) {
  let last_context = context_stack[context_stack.length - 1];

  if (EXECUTORS.hasOwnProperty(instruction.kind)) {
    return EXECUTORS[instruction.kind](instruction, context_stack, next_instructions);
  }

  if (instruction.kind === KINDS.DEFINE_SYMBOL) {
    let value = interprete_instruction(instruction.right, context_stack, next_instructions);

    last_context.symbols[instruction.left.name] = value;
  } else if (instruction.kind === KINDS.TUPLE) {
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
  } else if (instruction.kind === KINDS.DEFINE_SYMBOL) {
    last_context.defined_symbol = instruction.left.name;
  } else if (instruction.kind === KINDS.SYMBOL) {
    if (last_context.symbols.hasOwnProperty(instruction.name)) {
      return last_context.symbols[instruction.name];
    } else {
      throw new RuntimeError("Undefined variable: " + instruction.name, instruction.line, instruction.char);
    }
  } else if (instruction.kind === KINDS.NEXT_ELEMENT) {
    if (last_context.defined_symbol) {
      last_context.symbols[last_context.defined_symbol] = last_context.last_value;
      // console.log(last_context.symbols);
      last_context.defined_symbol = null;
    }
  }
}

const EXECUTORS = {};

const call_pattern = EXECUTORS[KINDS.PATTERN_CALL] = function call_pattern(instruction, context_stack, next_instructions) {
  let pattern = find_pattern_in_stack(instruction.pattern.name, context_stack);

  if (pattern) {
    if (typeof pattern._execute === "function") {
      let args = interprete_instruction(instruction.args, context_stack, next_instructions);
      // console.log("!>", args);
      let result = pattern._execute(args);
      return result;
    } else {
      let result = interpreter(pattern, context_stack);
      return result;
    }
  } else {
    throw new RuntimeError(`Pattern not found: ${instruction.pattern.name}`, instruction.line, instruction.char);
  }
};

EXECUTORS[KINDS.NUMBER] = (instruction) => instruction.number;

EXECUTORS[KINDS.STRING] = (instruction) => instruction.string;

EXECUTORS[KINDS.EXPRESSION] = function call_pattern(instruction, context_stack, next_instructions) {
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
      }
    } else if (typeof step === "symbol") {
      if (typeof stack[stack.length - 2] === "number") {
        let b = stack.pop();
        let a = stack.pop();
        stack.push(NUM_OPS[step](a, b));
      } else if (typeof stack[stack.length - 2] === "boolean") {
        throw new Error("Unimplemented");
      }
    } else {
      throw new Error("Unimplemented")
    }
  }
  return stack[0];
}

const NUM_OPS = {
  [KINDS.OP_ADD]: (a, b) => {
    if (typeof b === "number") {
      return a + b;
    } else if (Array.isArray(b) && b.length === 1) {
      return a + b[0];
    }
  },
  [KINDS.OP_MUL]: (a, b) => {
    if (typeof b === "number") {
      return a * b;
    } else if (Array.isArray(b) && b.length === 1) {
      return a * b[0];
    }
  }
}
