const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const util = require("util");

const parser = require("./parser.js");
const mangle = require("./mangle");
const prelude = require("./prelude.js");
const interpreter = require("./interpreter.js");
const {CompileError, RuntimeError} = require("./errors.js");
const KINDS = require("./kinds.js");

module.exports = function (source_path, args, config) {
  prelude.stdout = args.stdout || process.stdout;
  let sourced;
  try {
    sourced = load_and_resolve(path.resolve(process.cwd(), source_path), args, config);
    prelude.sourced = sourced;
    if (args.dumpTree) console.log(util.inspect(sourced, {showHidden: false, depth: null}));
    interpreter.interprete(sourced[sourced.$], [prelude]);
  } catch (e) {
    if (args.throwError) throw e;
    if (e instanceof CompileError || e instanceof RuntimeError) {
      e.print(sourced[e.file || sourced.$][KINDS.RAW].split(/\n/g));
      process.exit(2);
    } else {
      console.error(e);
      process.exit(1);
    }
  }
}

function load_and_resolve(root_path, args, config) {
  let visited = [];
  let sourced = {$: path.resolve(process.cwd(), root_path)};
  let to_load = [];
  let to_source = [path.resolve(process.cwd(), root_path)];

  function resolve(child_name, parent_path, instruction) {
    // if (!child_name) return null;

    let ext = path.extname(child_name) === "" ? ".patpat" : "";

    if (child_name.startsWith("./") || child_name.startsWith("../")) {
      child_name = path.resolve(path.dirname(parent_path), child_name);
      if (fs.lstatSync(child_name).isDirectory()) {
        if (fs.readdirSync(child_name).includes("main.patpat")) {
          return path.join(child_name, "main.patpat");
        }
      } else {
        return child_name + ext;
      }
    } else if (child_name.startsWith("/") || child_name.startsWith("~")) {
      throw new CompileError(`'use' and 'load' paths cannot begin with / or ~: '${child_name}'`, instruction.line, instruction.char, parent_path);
    } else if (child_name === "$") {
      throw new CompileError(`'use' and 'load' paths cannot be '$'`, instruction.line, instruction.char, parent_path);
    } else if (child_name === "") {
      throw new CompileError(`'use' and 'load' paths cannot be empty`, instruction.line, instruction.char, parent_path);
    }

    for (let lookup_dir of config.lookup_dirs) {
      if (fs.existsSync(lookup_dir) && fs.readdirSync(path.join(lookup_dir, child_name))) {
        if (fs.lstatSync(path.join(lookup_dir, child_name)).isDirectory()) {
          if (fs.readdirSync(path.join(lookup_dir, child_name)).includes("main.patpat")) {
            return path.join(lookup_dir, child_name, "main.patpat");
          }
        } else {
          return path.join(lookup_dir, child_name) + ext;
        }
      }
    }
    return null;
  }

  while (to_source.length) {
    let _path = to_source.pop();
    if (_path === null) continue;
    if (visited.includes(_path)) continue;
    visited.push(_path);
    let raw = fs.readFileSync(_path, "utf8");

    try {
      sourced[_path] = parser(raw, _path);
      sourced[_path].path = _path;
      sourced[_path][KINDS.RAW] = raw;

      for (let i of sourced[_path].instructions) {
        if (i.kind === KINDS.USE || i.kind === KINDS.LOAD) {
          let _path2 = resolve(i.path, _path, i);
          to_source.push(_path2);
          i.path = _path2;
        } else if (i.kind === KINDS.DECLARE_SYMBOL && i.right && (i.right.kind === KINDS.USE || i.right.kind === KINDS.LOAD)) {
          let _path2 = resolve(i.right.path, _path, i);
          to_source.push(_path2);
          i.right.path = _path2;
        }
      }
    } catch (e) {
      if (args.throwError) throw e;
      if (e instanceof CompileError) {
        e.print(raw.split(/\n/g));
        process.exit(2);
      } else {
        console.error(e);
        process.exit(1);
      }
    }
  }

  return sourced;
}
