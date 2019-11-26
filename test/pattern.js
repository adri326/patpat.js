const {assert} = require("chai");
const execute = require("../src/test-framework");
const {RuntimeError, CompileError} = require("../src/errors.js");

describe("Pattern declaration", () => {
  it("Should declare patterns", () => {
    execute("scripts/pattern/declaration.patpat");
  });

  it("Should throw an error while trying to declare a pattern with a non-function value", () => {
    assert.throws(() => {
      execute("scripts/pattern/invalid-declaration.patpat");
    }, CompileError);
  });
});

describe("Pattern execution", () => {
  it("Should be able to call a pattern", () => {
    let result = execute("scripts/pattern/execution.patpat");
    assert.equal(result, "I am a pattern.\nI am another pattern.\n");
  });
});
