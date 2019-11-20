const {assert} = require("chai");
const execute = require("../test-framework");
const {RuntimeError, CompileError} = require("../errors.js");

describe("Variable declaration", () => {
  it("Should assign a value to a variable and print it to stdout", () => {
    let result = execute("scripts/declaration.patpat");
    assert.equal(result, "I am a variable.");
  });

  it("Should throw an error while trying to redeclare a variable", () => {
    assert.throws(() => {
      execute("scripts/redeclaration.patpat");
    }, RuntimeError);
  });
});

describe("Variable assignement", () => {
  it("Should declare a variable, then assign a value to it", () => {
    let result = execute("scripts/assignement.patpat");
    assert.equal(result, "I am a variable.");
  });

  it("Should declare a variable with a value, then reassign a value to it", () => {
    let result = execute("scripts/reassignement.patpat");
    assert.equal(result, "I am not a variable.");
  });
});
