module.exports = function parser(raw) {
  let lines = raw.split(/\n/g);
  let terms = get_terms(raw);
  // console.log(terms);

  let tree = {
    instructions: []
  };
  function parse_body(sub_terms, branch, {is_tuple, is_array}) {
    let n = 0;
    while (sub_terms[n]) {
      let current_term = sub_terms[n];
      function match(term) {
        // console.log("> ", term.word);
        let match = null;
        for (let matcher of MATCHERS) {
          match = matcher.match(term);
          if (match) break;
        }
        return match;
      }

      let matched_term = match(current_term);

      if (matched_term) {
        // console.log(matched_term);
        switch (matched_term.matcher) {
          case MATCHERS.SINGLE_COMMENT:
            let current_line = current_term.line;
            while (sub_terms[++n].line === current_line);
            n--;
            break;
          case MATCHERS.PATTERN:
            branch.instructions.push({
              name: current_term.word,
              kind: KINDS.PATTERN
            });
            break;
          case MATCHERS.TUPLE_START:
            let twig = {
              instructions: [],
              kind: KINDS.TUPLE
            }
            n += parse_body(sub_terms.slice(++n), twig, {is_tuple: true});
            branch.instructions.push(twig);
            break;
          case MATCHERS.TUPLE_END:
            if (is_tuple) {
              return n + 1;
            } else {
              throw new Error(`Found tuple end while not being in a tuple: (${current_term.line}:${current_term.char})`);
            }
            break;
          case MATCHERS.STRING:
            let start = current_term.char;
            let end = null;
            while (sub_terms[++n]) {
              let m = match(sub_terms[n]);
              if (m && m.matcher === MATCHERS.STRING) {
                end = m.input.char;
                break;
              };
            }
            if (end === null) {
              throw new Error(`Unmatched string quote at (${current_term.line}:${current_term.char})`);
            }
            let str = lines[current_term.line].slice(start + 1, end + 1);
            branch.instructions.push({
              kind: KINDS.STRING,
              string: str
            });
            break;
        }
      } else {
        // TODO: uncomment the following line
        // throw new Error(`Unrecognized term: ${current_term.word} at (${current_term.line}:${current_term.char})`);
      }

      n++;
    }
    return n;
  }

  parse_body(terms, tree, {});
  // console.log(JSON.stringify(tree, " ", 2));
  return tree;
}

function get_terms(raw) {
  // Splits the input string in lines and in "terms", which are wordlet. It indicates their position in the input string too

  let lines = raw.split(/\r?\n/g);
  let terms = lines.reduce((acc, line, i) => {
    let words = line.split(/\s|(?=[\.\+\-\*\/:;,=<>'#\(\)\[\]\{\}"](?:[^\/]|$))(?<=[^\/]|^)|(?<=[\.\+\-\*\/:;,=<>\(\)\[\]\{\}"])(?!\/)/g);
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
    return acc.concat(parsed_words);
  }, []);

  return terms;
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
new TermMatcher("PATTERN", (str) => /^'\w+$/.exec(str), 200).append();
new TermMatcher("TUPLE_START", matches("("), 900).append();
new TermMatcher("TUPLE_END", matches(")"), 900).append();
new TermMatcher("NEXT_ELEMENT", matches(";"), 900).append();
new TermMatcher("STRING", matches('"'), 800).append();

MATCHERS = MATCHERS.sort((a, b) => a.priority - b.priority);
const KINDS = module.exports.KINDS = {
  TUPLE: Symbol("TUPLE"),
  STRING: Symbol("STRING"),
  PATTERN: Symbol("PATTERN"),
  NEXT_ELEMENT: Symbol("NEXT_ELEMENT")
};
