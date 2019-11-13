#! /usr/bin/node
// Dear code reader,
// this is a prototype, it is not meant to be efficient or anything. Efficiency is for a later day.

const fs = require("fs");
const path = require("path");
const source_path = require("yargs").argv._[0];

const parser = require("./parser.js");
const prelude = require("./prelude.js");
const interpreter = require("./interpreter.js");

let raw = fs.readFileSync(path.resolve(process.cwd(), source_path), "utf8");
let tree = parser(raw);

interpreter(tree, [prelude]);
