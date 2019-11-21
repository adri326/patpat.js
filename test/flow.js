const {assert} = require("chai");
const execute = require("../test-framework");
const {RuntimeError, CompileError} = require("../errors.js");

describe("Program flow: if, for, etc.", () => {
  describe("#if", () => {
    it("Should execute each argument of an if call based on its input.", () => {
      let result = execute("scripts/flow/if.patpat");
      assert.equal(result, "BA");
    });

    it("Should throw an error while trying to execute an if call with not enough arguments", () => {
      assert.throws(() => {
        execute("scripts/flow/if-nea.patpat");
      }, RuntimeError);
    });

    it("Should throw an error while trying to execute an if call with the 2nd parameter not being a function", () => {
      assert.throws(() => {
        execute("scripts/flow/if-invalid-type.patpat");
      }, RuntimeError);
    });
  });
});
