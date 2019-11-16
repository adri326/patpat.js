const KINDS = require("./kinds.js");
const {BINARY_OPS, UNARY_OPS, VALID_EXP_TERMS} = KINDS;
const {CompileError} = require("./errors.js");

//? This module takes all of the terms given by the parser and puts them together. It does this through different passes
// NOTE: this module should handle type errors

module.exports = function mangle_body(branch, options) {
  branch.instructions = branch.terms.concat([]);
  branch.indexes = [];

  // console.log(branch);
  mangle_functions(branch, options);
  mangle_calls(branch, options);
  mangle_unary_expressions(branch, options);
  mangle_expressions(branch, options);
  mangle_define(branch, options);
  mangle_declaration(branch, options);

  strip_separators(branch);

  if (options.is_tuple) {
    branch.length = branch.instructions.filter((instruction) => instruction.kind === KINDS.NEXT_ELEMENT).length + 1;
  }
  delete branch.terms;
  // console.log(branch);
}

function mangle_declaration(branch, {ctx_kind, is_tuple, is_array}) {
  // console.log(branch);
  for (let n = 0; n < branch.instructions.length; n++) {
    if (branch.instructions[n].kind === KINDS.LET) {
      if (n === branch.instructions.length - 1) {
        throw new CompileError(
          "LET at end of " + ctx_kind,
          branch.instructions[n].line,
          branch.instructions[n].char
        );
      } else if (is_tuple || is_array) {
        throw new CompileError(
          "Cannot have LET instructions in " + ctx_kind,
          branch.instructions[n].line,
          branch.instructions[n].char
        );
      }

      if (branch.instructions[n + 1].kind === KINDS.SYMBOL) {
        insert(branch, {
          kind: KINDS.DECLARE_SYMBOL,
          name: branch.instructions[n + 1].name,
          right: null,
          line: branch.instructions[n].line,
          char: branch.instructions[n].char
        }, n, 2);
      } else if (branch.instructions[n + 1].kind === KINDS.DEFINE_SYMBOL) {
        insert(branch, {
          kind: KINDS.DECLARE_SYMBOL,
          name: branch.instructions[n + 1].left.name,
          right: branch.instructions[n + 1].right,
          line: branch.instructions[n].line,
          char: branch.instructions[n].char
        }, n, 2);
      } else if (branch.instructions[n + 1].kind === KINDS.TUPLE) {
        throw new Error("Unimplemented");
      } else {
        throw new CompileError(
          "Invalid term following a LET instruction",
          branch.instructions[n + 1].line,
          branch.instructions[n + 1].char
        );
      }
    }
  }
}

function mangle_define(branch) {
  // this has to sweep from right to left, as to handle this kind of assignement:
  // a: b: a
  for (let n = branch.instructions.length - 1; n >= 0; n--) {
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
        if (right.kind !== KINDS.FUNCTION) {
          throw new CompileError("Pattern definitions must be followed by a function", right.line, right.char);
        }
        instruction = {
          kind: KINDS.DEFINE_PATTERN,
          name: left.name,
          args: right.args,
          body: right.body,
          line: left.line,
          char: left.char
        }
      }

      insert(branch, instruction, n - 1, 3);
      n--;
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

function mangle_unary_expressions(branch, {ctx_kind}) {
  for (let n = 0; n < branch.instructions.length; n++) {
    if (
      branch.instructions[n].kind === KINDS.OPERATOR
      && UNARY_OPS.includes(branch.instructions[n].operator)
    ) {
      if (n === branch.instructions.length - 1) {
        throw new CompileError("Operator at end of " + ctx_kind, branch.instructions[n].line, branch.instructions[n].char);
      }
      let unaries = [branch.instructions[n].operator];
      let o;

      for (o = n + 1; o < branch.instructions.length; o++) {
        if (
          branch.instructions[o].kind === KINDS.OPERATOR
          && UNARY_OPS.includes(branch.instructions[o].operator)
        ) {
          unaries.push(branch.instructions[o].operator);
        } else break;
      }

      if (!VALID_EXP_TERMS.includes(branch.instructions[o].kind)) {
        throw new CompileError(
          "Invalid term following expression",
          branch.instructions[o].line,
          branch.instructions[o].char
        );
      }

      insert(branch, {
        kind: KINDS.EXPRESSION,
        steps: [branch.instructions[o], ...unaries],
        line: branch.instructions[n].line,
        char: branch.instructions[n].char
      }, n, o - n + 1);
    }
  }
}

function mangle_expressions(branch, {is_tuple, is_array, ctx_kind}) {
  for (let n = 0; n < branch.instructions.length; n++) {
    if (branch.instructions[n].kind === KINDS.OPERATOR) {
      if (n === 0) {
        throw new CompileError("Operator at start of " + ctx_kind, branch.instructions[n].line, branch.instructions[n].char);
      } else if (n === branch.instructions.length - 1) {
        throw new CompileError("Operator at end of " + ctx_kind, branch.instructions[n].line, branch.instructions[n].char);
      }

      let operator = branch.instructions[n].operator;
      let elements = [branch.instructions[n - 1], branch.instructions[n + 1]];
      if (!VALID_EXP_TERMS.includes(elements[0].kind)) {
        throw new CompileError("Invalid term preceding operator", branch.instructions[n - 1].line, branch.instructions[n - 1].char);
      }
      if (!VALID_EXP_TERMS.includes(elements[1].kind)) {
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
          if (!VALID_EXP_TERMS.includes(branch.instructions[o + 1].kind)) {
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
        } else if (element.kind === KINDS.EXPRESSION) {
          steps = steps.concat(element.steps);
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
      n--;
    }
  }
}

function mangle_functions(branch) {
  for (let n = 0; n < branch.instructions.length; n++) {
    if (branch.instructions[n].kind === KINDS.ARROW) {
      if (branch.instructions[n - 1].kind !== KINDS.TUPLE && branch.instructions[n - 1].kind !== KINDS.ARRAY) {
        throw new CompileError(
          "Invalid term preceding arrow (should be a tuple or an instruction)",
          branch.instructions[n - 1].line,
          branch.instructions[n - 1].char
        );
      }
      if (branch.instructions[n + 1].kind !== KINDS.BLOCK && branch.instructions[n + 1].kind !== KINDS.TUPLE) {
        throw new CompileError(
          "Invalid term following arrow (should be a block or a tuple)",
          branch.instructions[n + 1].line,
          branch.instructions[n + 1].char
        );
      }

      let args = [];

      for (let instruction of branch.instructions[n - 1].instructions) {
        if (instruction.kind === KINDS.SYMBOL) {
          args.push({
            ...instruction,
            symbolic: false
          });
        } else if (instruction.kind === KINDS.NEXT_ELEMENT) {}
        else {
          throw new CompileError("Invalid element in function argument tuple: " + instruction.kind.description, instruction.line, instruction.char);
        }
        /* else if (instruction.kind === KINDS.EXPRESSION && instruction.operator === KINDS.SYMBOLIC_OPERATOR && instruction.steps.length === 2) {
          args.push({
            name: instruction.steps[0],
            symbolic: true
          });
        } */
      }

      // TODO: more checks, as this obviously needs more checks. (1, 2; 3) is not a valid arg tuple.

      insert(branch, {
        kind: KINDS.FUNCTION,
        args,
        body: branch.instructions[n + 1]
      }, n - 1, 3);
      n--;
    }
  }
}

function strip_separators(branch) {
  branch.instructions = branch.instructions.filter(x => x.kind !== KINDS.SEPARATOR);
}

function insert(branch, instruction, source, length) {
  branch.instructions = branch.instructions.slice(0, source).concat([instruction], branch.instructions.slice(source + length));
}
