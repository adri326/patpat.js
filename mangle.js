const KINDS = require("./kinds.js");
const {CompileError} = require("./errors.js");

//? This module takes all of the terms given by the parser and puts them together. It does this through different passes

module.exports = function mangle_body(branch, {is_tuple, is_array}) {
  branch.instructions = [];
  branch.indexes = [];

  // console.log(branch);

  mangle_next_element(branch);
  mangle_calls(branch);
  mangle_define(branch);

  mangle_lone_symbol(branch);


  if (is_tuple) {
    branch.length = branch.instructions.filter((instruction) => instruction.kind === KINDS.NEXT_ELEMENT).length + 1;
  }
  // console.log(branch);
}

function mangle_define(branch) {
  for (let n = 0; n < branch.terms.length; n++) {
    if (branch.terms[n] === null) continue;

    if (branch.terms[n].kind === KINDS.DEFINE) {
      if (n === 0) {
        throw new CompileError(
          "Define at start of file",
          branch.terms[n].line,
          branch.terms[n].char
        );
      } else if (n === branch.terms.length - 1) {
        throw new CompileError(
          "Define at end of file",
          branch.terms[n].line,
          branch.terms[n].char
        );
      }

      let left = get_term(branch, n - 1);
      let right = get_term(branch, n + 1);

      let instruction;

      if (branch.terms[n - 1].kind === KINDS.SYMBOL) {
        instruction = {
          kind: KINDS.DEFINE_SYMBOL,
          left,
          right
        };
      } else if ([KINDS.EXPRESSION, KINDS.TUPLE, KINDS.FUNCTION_CALL].includes(left.kind)) {
        instruction = {
          kind: KINDS.DEFINE_COMPLEX,
          left,
          right
        };
      } else if (left.kind === KINDS.PATTERN) {
        instruction = {
          kind: KINDS.DEFINE_PATTERN,
          left,
          right
        }
      }

      insert(branch, instruction, n - 1, 3);
    }
  }
}

function mangle_calls(branch) {
  for (let n = 0; n < branch.terms.length - 1; n++) {
    if (branch.terms[n] === null) continue;

    let c_kind = branch.terms[n].kind;
    if (
      c_kind === KINDS.TUPLE && c_kind.length === 1
      || c_kind === KINDS.SYMBOL
      || c_kind === KINDS.PATTERN
    ) {
      if (
        branch.terms[n + 1] !== null && (
          branch.terms[n + 1].kind === KINDS.TUPLE
          || branch.terms[n + 1].kind === KINDS.ARRAY
        )
      ) {
        let instruction;

        if (c_kind === KINDS.PATTERN) {
          instruction = {
            kind: KINDS.PATTERN_CALL,
            pattern: branch.terms[n],
            args: branch.terms[n + 1],
            line: branch.terms[n].line,
            char: branch.terms[n].char
          };
        } else {
          instruction = {
            kind: KINDS.FUNCTION_CALL,
            function: branch.terms[n],
            args: branch.terms[n + 1],
            line: branch.terms[n].line,
            char: branch.terms[n].char
          };
        }

        insert(branch, instruction, n, 2);
      }
    }
  }
}

function mangle_next_element(branch) {
  for (let n = 0; n < branch.terms.length; n++) {
    if (branch.terms[n] === null) continue;
    if (branch.terms[n].kind === KINDS.NEXT_ELEMENT) {
      insert(branch, branch.terms[n], n, 1);
    }
  }
}

function mangle_lone_symbol(branch) {
  for (let n = 0; n < branch.terms.length; n++) {
    if (branch.terms[n] === null) continue;
    if (branch.terms[n].kind === KINDS.SYMBOL || branch.terms[n].kind === KINDS.STRING) {
      insert(branch, branch.terms[n], n, 1);
    }
  }
}

function insert(branch, instruction, source, length) {
  //? Inserts the instruction at the right place and adds a number in the terms array pointing to where the instruction is now located
  let index = 0;
  for (let o = source; o >= 0; o--) {
    if (typeof branch.indexes[o] === "number") {
      index = branch.indexes[o] + 1;
      break;
    }
  }
  branch.instructions = branch.instructions.slice(0, index).concat([instruction], branch.instructions.slice(index));
  for (let n = source; n < source + length; n++) {
    branch.indexes[n] = index;
    branch.terms[n] = null; // they have been consumed
  }
}

function get_term(branch, n) {
  if (typeof branch.indexes[n] === "number") {
    return branch.instructions[branch.indexes[n]];
  } else {
    return branch.terms[n];
  }
}

/*
if (branch.instructions.length === 0) {
  throw new CompileError("Define at start of file", current_term.line, current_term.char);
}

let last_instruction = branch.instructions.pop();

if (last_instruction.kind === KINDS.TUPLE) {
  if (branch.instructions.length === 1) {
    throw new CompileError("Define following a tuple at start of file", current_term.line, current_term.char);
  }
  let second_instruction = branch.instructions.pop();
  if (second_instruction.kind !== KINDS.SYMBOL && second_instruction.kind !== KINDS.PATTERN) {
    throw new CompileError("Invalid (2nd) term preceding a define operator", current_term.line, current_term.char);
  }

  branch.instructions.push({
    left: [last_instruction, second_instruction],
    kind: KINDS.DEFINE_COMPLEX
  });

} else if (last_instruction.kind === KINDS.SYMBOL) {
  branch.instructions.push({
    left: last_instruction,
    kind: KINDS.DEFINE_SYMBOL
  });
} else if (last_instruction.kind === KINDS.PATTERN) {
  let next_instruction = match_term(sub_terms[n + 1]);

  if (!next_instruction || next_instruction.matcher !== MATCHERS.TUPLE_START) { // Simple check
    throw new CompileError("Invalid term following a pattern define operator", current_term.line, current_term.char);
  }

  branch.instructions.push({
    left: last_instruction,
    kind: KINDS.DEFINE_PATTERN
  });
} else {
  throw new CompileError("Invalid term preceding a define operator", current_term.line, current_term.char);
}
*/
