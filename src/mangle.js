const KINDS = require("./kinds.js");
const {BINARY_OPS, UNARY_OPS, VALID_EXP_TERMS} = KINDS;
const {CompileError} = require("./errors.js");
const Struct = require("./struct.js");

//! This module takes all of the terms given by the parser and puts them together. It does this through different passes
// NOTE: this module should handle type errors

module.exports = function mangle_body(branch, options) {
  /*! mangle_body(branch: ParsedTree, options; Object {ctx_kind: String, is_tuple: bool, is_array: bool})
    This method calls the different mangling stages, which puts terms together to create complex instructions.

    `branch.instructions` is where all the magic is done. It is, at the beginning, the `branch.terms` array.
    Every mangling transformation is done on the `branch.instructions`.
    If I did not mess this up, the transformations should be strongly normalizing.
  */
  branch.instructions = branch.terms.slice();

  mangle_functions(branch, options);
  mangle_struct(branch, options);
  mangle_calls(branch, options);
  mangle_accessors(branch, options);
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
  /*! mangle_declaration(<..>)
    This mangler handles the `let` keyword. It looks for `LET` terms.
    If a `LET` term is followed by a `SYMBOL`, it replaces both with a `DECLARE_SYMBOL` without default value.
    If a `LET` term is followed by a `DEFINE_SYMBOL`, it replaces both with a `DECLARE_SYMBOL` and a default value, extracted from the second term.
    It does not support tuple destructurisation yet.
  */
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
  /*! mangle_define(branch: ParsedTree)
    This mangler handles the `=` keyword. It looks at the kind of the instruction/term preceding it:
    - `SYMBOL`: inserts a `DEFINE_SYMBOL` instruction
    - `EXPRESSION`, `TUPLE`, `FUNCTION_CALLL`: inserts a `DEFINE_COMPLEX` instruction
    - `PATTERN`: inserts a `DEFINE_PATTERN` instruction
    - `MEMBER_ACCESSORS`: inserts a `DEFINE_MEMBER` instruction
  */
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
          right,
          line: left.line,
          char: left.char
        };
      } else if ([KINDS.EXPRESSION, KINDS.TUPLE, KINDS.FUNCTION_CALL].includes(left.kind)) {
        instruction = {
          kind: KINDS.DEFINE_COMPLEX,
          left,
          right,
          line: left.line,
          char: left.char
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
          char: left.char,
          is_method: right.is_method
        }
      } else if (left.kind === KINDS.MEMBER_ACCESSOR) {
        instruction = {
          kind: KINDS.DEFINE_MEMBER,
          parent: left.parent,
          member: left.member,
          right,
          line: left.line,
          char: left.char
        };
      } else {
        throw new CompileError("Unexpected term preceding assignement", left.line, left.char);
      }

      insert(branch, instruction, n - 1, 3);
      n--;
    }
  }
}

function mangle_calls(branch) {
  /*! mangle_calls(branch: ParsedTree)
    This function handles terms followed by a tuple `(a; b; ...)`, which are function calls.
    (Who on earth decided that it should be written this way? f(x)?! How can I decide if the tuple should be there or not?).
    If the left-hand-side term is a `TUPLE`, `FUNCTION_CALL`, `PATTERN_CALL`, `SYMBOL` or `PATTERN`, then it will insert a `PATTERN_CALL` (if lhs is `PATTERN`) or a `FUNCTION_CALL`.
  */
  for (let n = 0; n < branch.instructions.length - 1; n++) {
    let c_kind = branch.instructions[n].kind;
    if (
      c_kind === KINDS.TUPLE && branch.instructions[n].length === 1
      || c_kind === KINDS.FUNCTION_CALL
      || c_kind === KINDS.PATTERN_CALL
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
            fn: branch.instructions[n],
            args: branch.instructions[n + 1],
            line: branch.instructions[n].line,
            char: branch.instructions[n].char
          };
        }

        insert(branch, instruction, n, 2);
        n--;
      }
    }
  }
}

function mangle_unary_expressions(branch, {ctx_kind}) {
  /*! mangle_unary_expressions(branch: ParsedTree, options: Object {ctx_kind: String})
    Mangles unary expressions, that is, `!a` & such.
    If it finds such an operator, it inserts an `EXPRESSION`, replacing and containing the following operators up to the next non-operator term.
    Parsed-down expressions are in reverse polish notation, for convenience.
  */
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
  /*! mangle_expressions(branch: ParsedTree, options; Object {ctx_kind: String, is_tuple: bool, is_array: bool})
    Looks for non-unary `OPERATOR`s, and mangles everything around them that should be part of the expression into what will be an expression.
    It does not allow operator precedence, that is, if around it, another `OPERATOR`, that isn't the same as itself, is found, it will throw an error.
    Expressions are parsed down into reverse polish notation. The plan could then be to convert it to polish notation and then to lower-level assembly code.

    The first step in the function is to look for a binary operator, and check the types around it.
    It then looks forward to try to find another operator, and appends the elements in-between operators to the `elements` array.
    It then takes these elements, and parses them down into the `steps` array. If any of these elements is another TUPLE/EXPRESSION, it will insert its steps to the `steps` array instead.
    At the end of the day, we have a somewhat recursive expression parser. Which works.

    The 2nd version of the compiler should include a RPN to ASM generator. Here's a link for myself:
    https://compilers.iecc.com/crenshaw/tutor2.txt
  */
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
        } else {
          break;
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
      }, n - 1, o - n + 1);
      n--;
    }
  }
}

function mangle_functions(branch) {
  /*! mangle_functions(branch: ParsedTree)
    Handles the `=>` (`ARROW`) symbol. It should be preceded by a `TUPLE` and followed by a `BLOCK`.
    It inserts a `FUNCTION` instruction.
  */
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
      let is_method = false;

      for (let instruction of branch.instructions[n - 1].instructions) {
        if (instruction.kind === KINDS.SYMBOL) {
          args.push({
            ...instruction,
            symbolic: false
          });
          continue
        } else if (instruction.kind === KINDS.NEXT_ELEMENT) {
          continue;
        } else if (instruction.kind === KINDS.PATTERN_CALL) {
          if (instruction.pattern.name === "#self") {
            is_method = true;
            args.push({
              name: "self",
              optional: false,
              symbolic: false
            });
            continue;
          }
        }
        throw new CompileError("Invalid element in function argument tuple: " + instruction.kind.description, instruction.line, instruction.char);

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
        body: branch.instructions[n + 1],
        is_method
      }, n - 1, 3);
      n--;
    }
  }
}

function mangle_struct(branch, options) {
  /*! mangle_struct(branch: ParsedTree, options; Object {ctx_kind: String, is_tuple: bool, is_array: bool})
    Handles `struct` keywords (`STRUCT`).
    It looks at its body, and appends any symbol or pattern found in it.
  */
  for (let n = 0; n < branch.instructions.length; n++) {
    if (branch.instructions[n].kind === KINDS.STRUCT) {
      // Behold, there comes the error wall
      if (n >= branch.instructions.length - 1) {
        throw new CompileError("struct keyword at end of " + options.ctx_kind, branch.instructions[n].line, branch.instructions[n].char);
      } else if (n <= 1) {
        throw new CompileError("struct keyword at start of " + options.ctx_kind, branch.instructions[n].line, branch.instructions[n].char);
      } else if (branch.instructions[n - 1].kind !== KINDS.DEFINE) {
        throw new CompileError("struct keyword not preceded by a `:`", branch.instructions[n].line, branch.instructions[n].char);
      } else if (branch.instructions[n - 2].kind !== KINDS.TYPENAME) {
        throw new CompileError("struct keyword not preceded by a `TypeName` and a `:`", branch.instructions[n].line, branch.instructions[n].char);
      } else if (branch.instructions[n + 1].kind !== KINDS.BLOCK) {
        throw new CompileError("Invalid term following a struct keyword: expected BLOCK", branch.instructions[n + 1].line, branch.instructions[n + 1].char);
      }

      let symbols = {};
      let patterns = {};

      for (let instruction of branch.instructions[n + 1].instructions) {
        if (instruction.kind === KINDS.DECLARE_SYMBOL) {
          symbols[instruction.name] = {
            kind: KINDS.DECLARE_SYMBOL,
            name: instruction.name,
            default_value: instruction.right,
            line: instruction.line,
            char: instruction.char
          };
        } else if (instruction.kind === KINDS.DEFINE_PATTERN) {
          patterns[instruction.name] = instruction;
        } else if (instruction.kind === KINDS.NEXT_ELEMENT);
        else {
          throw new CompileError("Invalid term within a struct definition: " + instruction.kind.description, instruction.line, instruction.char);
        }
      }

      insert(branch, new Struct({
        name: branch.instructions[n - 2].name,
        symbols,
        patterns,
        line: branch.instructions[n].line,
        char: branch.instructions[n].char
      }), n - 2, 4);
    }
  }
}

function mangle_accessors(branch, options) {
  /*! mangle_accessors(branch: ParsedTree, options; Object {ctx_kind: String, is_tuple: bool, is_array: bool})
    Handles the `.` (`MEMBER_ACCESSOR`) keyword.
    Valid terms on the left are `PATTERN_CALL`, `TUPLE`, `SYMBOL`, `TYPENAME`.
    If it is a `TYPENAME` and followed by a `PATTERN_CALL`, it inserts a `STRUCT_INIT` instruction.
    Otherwise, it inserts a `MEMBER_ACCESSOR` instruction.
  */
  for (let n = 0; n < branch.instructions.length; n++) {
    if (branch.instructions[n].kind === KINDS.MEMBER_ACCESSOR) {
      if (n === 0) {
        throw new CompileError("Member accessor at start of " + option.ctx_kind, instructions[n].line, instructions[n].char);
      } else if (n === branch.instructions.length - 1) {
        throw new CompileError("Member accessor at end of " + option.ctx_kind, instructions[n].line, instructions[n].char);
      }

      if (![KINDS.PATTERN_CALL, KINDS.TUPLE, KINDS.SYMBOL, KINDS.TYPENAME].includes(branch.instructions[n - 1].kind)) {
        throw new CompileError("Invalid term preceding a member accessor", branch.instructions[n - 1].line, branch.instructions[n - 1].char);
      }
      // TODO: implement more ways to access members of a struct (tuple, pattern)
      if (![KINDS.SYMBOL, KINDS.PATTERN_CALL, KINDS.FUNCTION_CALL].includes(branch.instructions[n + 1].kind)) {
        throw new CompileError("Invalid term following a member accessor", branch.instructions[n + 1].line, branch.instructions[n + 1].char);
      }

      if (branch.instructions[n - 1].kind === KINDS.TYPENAME) {
        if (branch.instructions[n + 1].kind === KINDS.PATTERN_CALL) {
          insert(branch, {
            kind: KINDS.STRUCT_INIT,
            name: branch.instructions[n - 1].name,
            pattern: branch.instructions[n + 1].pattern.name,
            args: branch.instructions[n + 1].args,
            line: branch.instructions[n - 1].line,
            char: branch.instructions[n - 1].char
          }, n - 1, 3);
          continue;
        }
      }

      insert(branch, {
        kind: KINDS.MEMBER_ACCESSOR,
        parent: branch.instructions[n - 1],
        member: branch.instructions[n + 1],
        line: branch.instructions[n - 1].line,
        char: branch.instructions[n - 1].char
      }, n - 1, 3);
    }
  }
}

function strip_separators(branch) {
  /*! strip_separators(branch: ParsedTree)
    Removes `SEPARATOR`s (`;`) from the instructions array.
  */
  branch.instructions = branch.instructions.filter(x => x.kind !== KINDS.SEPARATOR);
}

function insert(branch, instruction, source, length) {
  branch.instructions = branch.instructions.slice(0, source).concat([instruction], branch.instructions.slice(source + length));
}
