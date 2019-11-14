const KINDS = require("./kinds.js");
const {RuntimeError} = require("./errors.js");

module.exports = function interpreter(tree, stack) {
  // console.log(JSON.stringify(tree, " ", 2));
  let context_stack = [...stack, {patterns: {}, symbols: {}}];
  for (let n = 0; n < tree.instructions.length; n++) {
    let last_context = context_stack[context_stack.length - 1];

    let result = interprete_instruction(tree.instructions[n], context_stack, tree.instructions.slice(n+1));
    last_context.last_value = result;
  }
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

  if (instruction.kind === KINDS.PATTERN_CALL) {
    let pattern = find_pattern_in_stack(instruction.pattern.name, context_stack);
    if (pattern) {
      if (typeof pattern._execute === "function") {
        let args = interprete_instruction(instruction.args, context_stack, next_instructions);
        // console.log("!>", args);
        let result = pattern._execute(args);
        return result;
      } else {
        // TODO
        throw new Error("Unimplemented");
      }
    } else {
      throw new RuntimeError(`Pattern not found: ${instruction.pattern.name}`, instruction.line, instruction.char);
    }
  } else if (instruction.kind === KINDS.DEFINE_SYMBOL) {
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
  } else if (instruction.kind === KINDS.STRING) {
    return instruction.string;
  }
}
