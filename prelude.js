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
  },
  "'version": {
    kind: KINDS.PATTERN,
    instructions: [{
      kind: KINDS.STRING,
      string: "0.0.2"
    }]
  }
}

prelude.symbols = {};
