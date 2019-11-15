const KINDS = require("./kinds.js");
const {CompileError} = require("./errors.js");

//? This module takes all of the terms given by the parser and puts them together. It does this through different passes
// NOTE: this module should handle type errors

module.exports = function mangle_body(branch, options) {
  branch.instructions = branch.terms.concat([]);
  branch.indexes = [];

  // console.log(branch);
  mangle_calls(branch, options);
  mangle_expressions(branch, options);
  mangle_define(branch, options);


  if (options.is_tuple) {
    branch.length = branch.instructions.filter((instruction) => instruction.kind === KINDS.NEXT_ELEMENT).length + 1;
  }
  delete branch.terms;
  // console.log(branch);
}

function mangle_define(branch) {
  for (let n = 0; n < branch.instructions.length; n++) {
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

function mangle_expressions(branch, {is_tuple, is_array, ctx_kind}) {
  const VALID_TERMS = [KINDS.STRING, KINDS.NUMBER, KINDS.BOOLEAN, KINDS.ARRAY, KINDS.SYMBOL, KINDS.TUPLE, KINDS.FUNCTION_CALL, KINDS.PATTERN_CALL];
  for (let n = 0; n < branch.instructions.length; n++) {
    if (branch.instructions[n].kind === KINDS.OPERATOR) {
      if (n === 0) {
        throw new CompileError("Operator at start of " + ctx_kind, branch.instructions[n].line, branch.instructions[n].char);
      } else if (n === branch.instructions.length - 1) {
        throw new CompileError("Operator at end of " + ctx_kind, branch.instructions[n].line, branch.instructions[n].char);
      }

      let operator = branch.instructions[n].operator;
      let elements = [branch.instructions[n - 1], branch.instructions[n + 1]];
      if (!VALID_TERMS.includes(elements[0].kind)) {
        throw new CompileError("Invalid term preceding operator", branch.instructions[n - 1].line, branch.instructions[n - 1].char);
      }
      if (!VALID_TERMS.includes(elements[1].kind)) {
        throw new CompileError("Invalid term following operator", branch.instructions[n + 1].line, branch.instructions[n + 1].char);
      }

      let o;

      for (o = n + 2; o < branch.instructions.length; o += 2) {
        if (branch.instructions[o].kind === KINDS.OPERATOR) {
          if (o === branch.instructions.length - 1) {
            throw new CompileError("Operator at end of " + ctx_kind, branch.instructions[o].line, branch.instructions[o].char);
          }
          if (branch.instructions[o].operator !== branch.instructions[n].operator) {
            throw new CompileError("Operator precedence is not supported", branch.instructions[o].line, branch.instructions[o].char);
          }
          if (!VALID_TERMS.includes(branch.instructions[o + 1].kind)) {
            throw new CompileError("Invalid term following operator", branch.instructions[o + 1].line, branch.instructions[o + 1].char);
          }
          elements.push(branch.instructions[o + 1]);
        }
      }

      let steps = [];
      for (let element of elements) {
        if (element.kind === KINDS.TUPLE && element.length === 1) {
          if (element.instructions.length === 1 && element.instructions[0].kind === KINDS.EXPRESSION) {
            steps = steps.concat(element.instructions[0].steps);
            continue;
          }
        }
        steps.push(element);
      }
      for (let i = 0; i < elements.length - 1; i++) steps.push(branch.instructions[n].operator);

      insert(branch, {
        kind: KINDS.EXPRESSION,
        operator: branch.instructions[n].operator,
        line: branch.instructions[n].line,
        char: branch.instructions[n].char,
        steps
      }, n - 1, steps.length);
    }
  }
}

function insert(branch, instruction, source, length) {
  branch.instructions = branch.instructions.slice(0, source).concat([instruction], branch.instructions.slice(source + length));
}
