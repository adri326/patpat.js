const chalk = require("chalk");
const mangle = require("./mangle.js");
const KINDS = require("./kinds.js");
const {CompileError} = require("./errors.js");

let lines;

module.exports = function parser(raw) {
  lines = raw.split(/\n/g);
  let terms = get_terms(raw);

  let tree = {
    terms: []
  };

  parse_body(terms, tree, {ctx_kind: "file", is_block: true});
  // console.log(JSON.stringify(tree, " ", 2));
  return tree;
};

function parse_body(sub_terms, branch, options) {
  /*? Recursive function which parses the body of the code
      It tries to match every term against a set of symbol matchers (MATCHERS)
      Once this is done, it processes them.
  */

  let n = 0;
  while (sub_terms[n]) {
    let current_term = sub_terms[n];

    let twig;
    switch (current_term.matcher) {
      case MATCHERS.SINGLE_COMMENT: // Skips to the next line
        let current_line = current_term.line;
        while (sub_terms[++n].line === current_line);
        n--;

        break;
      case MATCHERS.PATTERN: // Registers a pattern instruction
        branch.terms.push({
          name: current_term.word,
          kind: KINDS.PATTERN,
          line: current_term.line,
          char: current_term.char
        });

        break;
      case MATCHERS.TUPLE_START: // Calls parse_body as a tuple
        twig = {
          terms: [],
          kind: KINDS.TUPLE,
          line: current_term.line,
          char: current_term.char
        };
        n += parse_body(sub_terms.slice(++n), twig, {is_tuple: true, ctx_kind: "tuple"});
        branch.terms.push(twig);

        break;
      case MATCHERS.TUPLE_END: // Returns parse_body if we are a tuple
        if (options.is_tuple) {
          mangle(branch, options);
          return n + 1;
        } else {
          throw new CompileError(`Found tuple end without being in a tuple.`, current_term.line, current_term.char);
        }

        break;
      case MATCHERS.BLOCK_START:
        twig = {
          terms: [],
          kind: KINDS.BLOCK,
          line: current_term.line,
          char: current_term.char
        };
        n += parse_body(sub_terms.slice(++n), twig, {is_block: true, ctx_kind: "block"});
        branch.terms.push(twig);

        break;
      case MATCHERS.BLOCK_END:
        if (options.is_block) {
          mangle(branch, options);
          return n + 1;
        } else {
          throw new CompileError("Found block end without being in a block.", current_term.line, current_term.char);
        }

        break;
      case MATCHERS.STRING: // Looks for the next "string" character and grabs the stuff between the both of them
        branch.terms.push({
          kind: KINDS.STRING,
          string: parse_string_escapes(current_term.word.slice(1, -1)),
          line: current_term.line,
          char: current_term.char
        });

        break;
      case MATCHERS.SYMBOL: // Adds this symbol to the terms
        branch.terms.push({
          name: current_term.word,
          kind: KINDS.SYMBOL,
          line: current_term.line,
          char: current_term.char
        });

        break;
      case MATCHERS.DEFINE: // If the last instruction was a tuple, looks for the last two terms, otherwise only looks for the last one.
        // It then pops them off from the instruction set and puts them together in an instruction
        branch.terms.push({
          kind: KINDS.DEFINE,
          line: current_term.line,
          char: current_term.char
        })

        break;
      case MATCHERS.NEXT_ELEMENT:
        branch.terms.push({
          kind: KINDS.NEXT_ELEMENT,
          line: current_term.line,
          char: current_term.char
        });

        break;
      case MATCHERS.OPERATOR:
        branch.terms.push({
          kind: KINDS.OPERATOR,
          line: current_term.line,
          char: current_term.char,
          operator: OPERATORS[current_term.word]
        });

        break;
      case MATCHERS.NUMBER:
        branch.terms.push({
          kind: KINDS.NUMBER,
          line: current_term.line,
          char: current_term.char,
          number: +current_term.word
        });

        break;
      case MATCHERS.BOOLEAN:
        branch.terms.push({
          kind: KINDS.BOOLEAN,
          line: current_term.line,
          char: current_term.char,
          state: current_term.word === "true"
        });

        break;
      case MATCHERS.ARROW:
        branch.terms.push({
          kind: KINDS.ARROW,
          line: current_term.line,
          char: current_term.char
        });

        break;
      case MATCHERS.LET:
        branch.terms.push({
          kind: KINDS.LET,
          line: current_term.line,
          char: current_term.char
        });

        break;
      case MATCHERS.SEPARATOR:
        branch.terms.push({
          kind: KINDS.SEPARATOR,
          line: current_term.line,
          char: current_term.char
        });

        break;
    }

    n++;
  }

  mangle(branch, options);

  return n;
}

function get_terms(raw) {
  // Splits the input string in lines and in "terms", which are wordlet. It indicates their position and by which matcher it was matched

  let lines = raw.split(/\r?\n/g);
  let terms = lines.reduce((acc, line, i) => {
    let words = [];
    let char_count = 0;
    let is_string = false;

    while (char_count < line.length) {
      let result_found = false;
      let result;

      if (is_string) { // Handles strings in a special way -- looks for a closing "
        let sanitized = line.slice(char_count).replace(/\\(?:[\\n"])/g, "  "); // \n & such are replaced with whitespaces, as to give the next line a fresh input
        let closing_term = /"/.exec(sanitized);

        if (closing_term) {
          is_string = false;
          let str = line.slice(words[words.length - 1].char, words[words.length - 1].char + closing_term.index + 2);
          words[words.length - 1] = {
            word: `${str}`,
            line: i,
            char: char_count,
            matcher: words[words.length - 1].matcher,
            sym: words[words.length - 1].sym
          };
          char_count += closing_term.index + 1;
          continue;
        } else { // No closing term found, throw error
          throw new CompileError("No closing string term", i, char_count);
        }
      } else {
        for (let matcher of MATCHERS) {
          result = matcher.match(line.slice(char_count));
          
          if (result) {
            words.push({
              word: result.input,
              line: i,
              char: char_count,
              matcher: result.matcher,
              sym: result.sym
            });
            char_count += result.input.length;
            result_found = true;
            break;
          }
        }
      }

      if (!result_found) {
        throw new CompileError("Unrecognized term", i, char_count);
      } else if (result.matcher === MATCHERS.SINGLE_COMMENT) { // go to the next line
        break;
      } else if (result.matcher === MATCHERS.STRING) {
        is_string = true;
      }
    }

    return acc.concat(words).filter(term => !/^\s+$/.exec(term.word));
  }, []);

  return terms;
}

function match_term(term) {
  let match = null;
  for (let matcher of MATCHERS) {
    match = matcher.match(term);
    if (match) break;
  }
  return match;
}

function parse_string_escapes(str) {
  return str.replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

let MATCHERS = [];

class TermMatcher {
  constructor(name, match, priority = 0) {
    this.name = name;
    this.match_expr = match;
    this.symbol = Symbol(name);
    this.priority = priority;
  }

  append() {
    MATCHERS.push(this);
    MATCHERS[this.symbol] = this;
    MATCHERS[this.name] = this;
    return this;
  }

  match(str) {
    let res = this.match_expr.exec(str);
    if (res) {
      return {
        input: res[0],
        sym: this.symbol,
        matcher: this
      };
    } else {
      return null;
    }
  }
}

function matches(str) {
  return (term) => term === str;
}

new TermMatcher("SPACE", /^\s+/, 2000).append();
new TermMatcher("SINGLE_COMMENT", /^\/\//, 1000).append();
new TermMatcher("PATTERN", /^['#]\w[\w_\d]*/, 200).append();
new TermMatcher("TUPLE_START", /^\(/, 900).append();
new TermMatcher("TUPLE_END", /^\)/, 900).append();
new TermMatcher("BLOCK_START", /^{/, 900).append();
new TermMatcher("BLOCK_END", /^}/, 900).append();
new TermMatcher("NEXT_ELEMENT", /^;/, 900).append();
new TermMatcher("STRING", /^"/, 800).append();
new TermMatcher("DEFINE", /^:/, 900).append();
new TermMatcher("SYMBOL", /^\w[\w_\d]*/, -100).append();
new TermMatcher("OPERATOR", /^(?:[+\-*\/!]|&&|\|\|)/, 700).append();
new TermMatcher("NUMBER", /^-?\d+(?:\.\d*)?/, 800).append();
new TermMatcher("BOOLEAN", /^(?:true|false)/, 500).append();
new TermMatcher("ARROW", /^=>/, 1200).append();
new TermMatcher("LET", /^let/, 600).append();
new TermMatcher("SEPARATOR", /^,/, 700).append();


MATCHERS = MATCHERS.sort((a, b) => b.priority - a.priority);
OPERATORS = {
  "+": KINDS.OP_ADD,
  "-": KINDS.OP_SUB,
  "*": KINDS.OP_MUL,
  "/": KINDS.OP_DIV,
  "||": KINDS.OP_OR,
  "&&": KINDS.OP_AND,
  "!": KINDS.OP_NOT
}
