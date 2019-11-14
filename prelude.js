const parser = require("./parser.js");
const KINDS = require("./kinds.js");
const prelude = module.exports = {};

prelude.patterns = {
  "'println": {
    kind: KINDS.PATTERN,
    instructions: [],
    _execute: (args) => {
      console.log(...args);
    }
  }
}

prelude.symbols = {};
