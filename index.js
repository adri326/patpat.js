#! /usr/bin/node
// Dear code reader,
// this is a prototype, it is not meant to be efficient or anything. Efficiency is for a later day.

const args = require("yargs")
  .option("config", {
    alias: "c",
    type: "string",
    description: "Path to an alternate config file than your ~/.config/patpat/config.json"
  })
  .argv;

let config = require("./src/read_config.js")(args.config);

require("./src/patpat.js")(args._[0], args, config);
