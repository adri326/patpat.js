const {assert} = require("chai");
const execute = require("../test-framework");
const {RuntimeError, CompileError} = require("../errors.js");

describe("Structs", () => {
  it("Should successfully define, declare and run methods on structs, which may have access to the `self` reference", () => {
    let result = execute("scripts/struct/definition.patpat");
    assert.equal(result, "I am thrown at Shad with great force!\n");
  });
});
