const {assert} = require("chai");
const execute = require("../src/test-framework");
const {RuntimeError, CompileError} = require("../src/errors.js");

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
  describe("#for", () => {
    it("Should loop according to the given amount", () => {
      let result = execute("scripts/flow/for.patpat");
      assert.equal(result, "3\n4\n5\n6\n");
    });

    it("Should throw an error while trying to execute a for loop while missing its third argument", () => {
      assert.throws(() => {
        execute("scripts/flow/for-nea.patpat");
      }, RuntimeError);
    });
  });
});
