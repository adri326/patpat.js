const parser = require("./parser.js");
const prelude = module.exports = {};

prelude.patterns = {
  "'println": {
    kind: parser.KINDS.PATTERN,
    instructions: [],
    _execute: (args) => {
      console.log(...args);
    }
  }
}
