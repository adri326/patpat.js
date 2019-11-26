const {assert} = require("chai");
const execute = require("../src/test-framework");
const {RuntimeError, CompileError} = require("../src/errors.js");

describe("Structs", () => {
  it("Should successfully define, declare and run methods on structs, which may have access to the `self` reference", () => {
    let result = execute("scripts/struct/definition.patpat");
    assert.equal(result, "I am thrown at Shad with great force!\n");
  });
});
