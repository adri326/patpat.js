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

    it("Should also work if the arguments are not functions", () => {
      let result = execute("scripts/flow/if-no-function.patpat");
      assert.equal(result, "Execute me!");
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

  describe("#while", () => {
    it("Should loop over until the condition becomes false", () => {
      let result = execute("scripts/flow/while.patpat");
      let expected = "";
      for (let x = 1; x <= 10; x++) {
        expected += x + "\n";
      }
      assert.equal(result, expected);
    });
  });

  describe("Blocks", () => {
    it("Should execute blocks and use its last value as return value, just like a function body does", () => {
      let result = execute("scripts/flow/block.patpat");
      assert.equal(result, "Yet you will see me instead");
    });
  });

  describe("use/load", () => {
    it("Should execute instructions within an #use statement and export its symbols, patterns and structs", () => {
      let result = execute("scripts/flow/use.patpat");
      assert.equal(result, "This will be printed first.\nAnd this will be printed second.\nI like this a lot!\n");
    });

    it("Should load patterns and structs with #load, without executing the inner instructions", () => {
      let result = execute("scripts/flow/load.patpat");
      assert.equal(result, "I like this a lot!\n");
    });
  });
});
