#! /usr/bin/node
// Dear code reader,
// this is a prototype, it is not meant to be efficient or anything. Efficiency is for a later day.

const args = require("yargs").argv;

require("./src/patpat.js")(args._[0], args);
