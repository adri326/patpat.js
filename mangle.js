const KINDS = require("./kinds.js");
const {CompileError} = require("./errors.js");

//? This module takes all of the terms given by the parser and puts them together. It does this through different passes

module.exports = function mangle_body(branch, {is_tuple, is_array}) {
  branch.instructions = branch.terms.concat([]);
  branch.indexes = [];

  // console.log(branch);
  mangle_calls(branch);
  // TODO: mangle_expressions(branch);
  mangle_define(branch);


  if (is_tuple) {
    branch.length = branch.instructions.filter((instruction) => instruction.kind === KINDS.NEXT_ELEMENT).length + 1;
  }
  // console.log(branch);
}

function mangle_define(branch) {
  for (let n = 0; n < branch.instructions.length; n++) {
    if (branch.instructions[n] === null) continue;

    if (branch.instructions[n].kind === KINDS.DEFINE) {
      if (n === 0) {
        throw new CompileError(
          "Define at start of file",
          branch.instructions[n].line,
          branch.instructions[n].char
        );
      } else if (n === branch.instructions.length - 1) {
        throw new CompileError(
          "Define at end of file",
          branch.instructions[n].line,
          branch.instructions[n].char
        );
      }

      let left = branch.instructions[n - 1];
      let right = branch.instructions[n + 1];

      let instruction;

      if (branch.instructions[n - 1].kind === KINDS.SYMBOL) {
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
  for (let n = 0; n < branch.instructions.length - 1; n++) {
    if (branch.instructions[n] === null) continue;

    let c_kind = branch.instructions[n].kind;
    if (
      c_kind === KINDS.TUPLE && c_kind.length === 1
      || c_kind === KINDS.SYMBOL
      || c_kind === KINDS.PATTERN
    ) {
      if (
        branch.instructions[n + 1] !== null && (
          branch.instructions[n + 1].kind === KINDS.TUPLE
          || branch.instructions[n + 1].kind === KINDS.ARRAY
        )
      ) {
        let instruction;

        if (c_kind === KINDS.PATTERN) {
          instruction = {
            kind: KINDS.PATTERN_CALL,
            pattern: branch.instructions[n],
            args: branch.instructions[n + 1],
            line: branch.instructions[n].line,
            char: branch.instructions[n].char
          };
        } else {
          instruction = {
            kind: KINDS.FUNCTION_CALL,
            function: branch.instructions[n],
            args: branch.instructions[n + 1],
            line: branch.instructions[n].line,
            char: branch.instructions[n].char
          };
        }

        insert(branch, instruction, n, 2);
      }
    }
  }
}


function insert(branch, instruction, source, length) {
  branch.instructions = branch.instructions.slice(0, source).concat([instruction], branch.instructions.slice(source + length));
}
