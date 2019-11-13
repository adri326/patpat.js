const parser = require("./parser.js");

module.exports = function interpreter(tree, stack) {
  let context_stack = [...stack, {patterns: {}, variables: {}}];
  for (let n = 0; n < tree.instructions.length; n++) {
    interprete_instruction(tree.instructions[n], context_stack, tree.instructions.slice(n+1));
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
  if (instruction.kind === parser.KINDS.PATTERN) {
    let pattern = find_pattern_in_stack(instruction.name, context_stack);
    if (pattern) {
      if (typeof pattern._execute === "function") {
        let args;
        if (next_instructions[0] && next_instructions[0].kind === parser.KINDS.TUPLE) {
          args = interprete_instruction(next_instructions[0], context_stack, next_instructions.slice(1));
        } else {
          throw new Error("Pattern not followed by tuples aren't supported yet")
        }
        let result = pattern._execute(args);
        return result;
      } else {
        // TODO
        throw new Error("Unimplemented");
      }
    } else {
      throw new Error(`Pattern not found: ${instruction.name}`);
    }
  } else if (instruction.kind === parser.KINDS.TUPLE) {
    let elements = [];
    let n_element = 0;
    for (let sub_instruction of instruction.instructions) {
      if (sub_instruction.kind === parser.KINDS.NEXT_ELEMENT) {
        n_element++;
      } else {
        elements[n_element] = interprete_instruction(sub_instruction, context_stack);
      }
    }
    return elements;
  } else if (instruction.kind === parser.KINDS.STRING) {
    return instruction.string;
  }
}
