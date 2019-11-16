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
    let matched_term = match_term(current_term);

    if (matched_term) { // This bit processes the matched term
      let twig;
      switch (matched_term.matcher) {
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
          let start = current_term.char;
          let end = null;
          while (sub_terms[++n]) {
            let m = match_term(sub_terms[n]);
            if (m && m.matcher === MATCHERS.STRING) {
              end = m.input.char;
              break;
            };
          }

          if (end === null) {
            throw new CompileError(`Unmatched string quote`, current_term.line, current_term.char);
          }

          let str = parse_string_escapes(lines[current_term.line].slice(start + 1, end));
          branch.terms.push({
            kind: KINDS.STRING,
            string: str,
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
    } else {
      // TODO: uncomment the following line
      // throw new CompileError(`Unrecognized term: ${current_term.word} at (${current_term.line}:${current_term.char})`);
    }

    n++;
  }

  mangle(branch, options);

  return n;
}

function get_terms(raw) {
  // Splits the input string in lines and in "terms", which are wordlet. It indicates their position in the input string too

  let lines = raw.split(/\r?\n/g);
  let terms = lines.reduce((acc, line, i) => {
    let words = line.split(/(?=\s)|(?<=\s)|(?=[\.\+\-\*\/:;,=<'#\(\)\[\]\{\}"!])(?<=[^\/\\]|^)|(?<=[\.\+\-\*\/:;,<>\(\)\[\]\{\}"!])(?!\/)|(?=&)(?<=[^&])|(?=\|)(?<=[^|])|(?<==)(?!>)|(?=>)(?<=[^=])/g);
    let char_count = 0;
    let parsed_words = words.map((word) => {
      let old_char_count = char_count;
      char_count += word.length;
      return {
        word,
        line: i,
        char: old_char_count
      };
    });
    return acc.concat(parsed_words).filter(term => !/^\s+$/.exec(term.word));
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
    if (this.match_expr(str.word)) {
      return {
        input: str,
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

new TermMatcher("SINGLE_COMMENT", matches("//"), 1000).append();
new TermMatcher("PATTERN", (str) => /^['#]\w+$/.exec(str), 200).append();
new TermMatcher("TUPLE_START", matches("("), 900).append();
new TermMatcher("TUPLE_END", matches(")"), 900).append();
new TermMatcher("BLOCK_START", matches("{"), 900).append();
new TermMatcher("BLOCK_END", matches("}"), 900).append();
new TermMatcher("NEXT_ELEMENT", matches(";"), 900).append();
new TermMatcher("STRING", matches('"'), 800).append();
new TermMatcher("DEFINE", matches(":"), 900).append();
new TermMatcher("SYMBOL", (str) => /^\w+$/.exec(str), -100).append();
new TermMatcher("OPERATOR", (str) => /^(?:[+\-*\/!]|&&|\|\|)$/.exec(str), 700).append();
new TermMatcher("NUMBER", (str) => /^-?\d+(?:\.\d*)?$/.exec(str), 800).append();
new TermMatcher("BOOLEAN", (str) => str === "true" || str === "false", 500).append();
new TermMatcher("ARROW", matches("=>"), 1200).append();
new TermMatcher("LET", matches("let"), 600).append();
new TermMatcher("SEPARATOR", matches(","), 700).append();

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
