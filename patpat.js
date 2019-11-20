const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const util = require("util");

const parser = require("./parser.js");
const mangle = require("./mangle");
const prelude = require("./prelude.js");
const interpreter = require("./interpreter.js");
const {CompileError, RuntimeError} = require("./errors.js");

module.exports = function (source_path, args) {
  prelude.stdout = args.stdout || process.stdout;
  let raw = fs.readFileSync(path.resolve(process.cwd(), source_path), "utf8");
  let tree;
  try {
    tree = parser(raw);
    if (args.dumpTree) console.log(util.inspect(tree, {showHidden: false, depth: null}));
    interpreter(tree, [prelude]);
  } catch (e) {
    if (e instanceof CompileError || e instanceof RuntimeError) {
      e.print(raw.split(/\n/g));
      process.exit(2);
    } else {
      console.error(e);
      process.exit(1);
    }
  }
}
