const path = require("path");
const {assert} = require("chai");
const execute = require("../test-framework");

describe("Variable declaration", () => {
  it("Should assign a value to a variable and print it to stdout", () => {
    let result = execute(path.join(__dirname, "scripts/declaration.patpat"));
    assert.equal(result, "I am a variable.");
  });
});

describe("Variable assignement", () => {
  it("Should declare a variable, then assign a value to it", () => {
    let result = execute(path.join(__dirname, "scripts/assignement.patpat"));
    assert.equal(result, "I am a variable.");
  });
  it("Should declare a variable with a value, then reassign a value to it", () => {
    let result = execute(path.join(__dirname, "scripts/reassignement.patpat"));
    assert.equal(result, "I am not a variable.");
  });
});
