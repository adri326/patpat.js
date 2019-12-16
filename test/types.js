const {assert} = require("chai");
const execute = require("../src/test-framework");
const {RuntimeError, CompileError} = require("../src/errors.js");

describe("Types", () => {
  it("Should allow type definition in pattern definitions and not throw when an argument of the right type is given to it.", () => {
    let result = execute("scripts/types/definition.patpat");
    assert.equal(result, "Jack\n");
  });
  it("Should forbid arguments of the wrong type to be given to a pattern whose argument type was defined.", () => {
    assert.throws(() => {
      execute("scripts/types/invalid_type.patpat");
    }, RuntimeError);
  });
});
