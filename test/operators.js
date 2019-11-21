const {assert} = require("chai");
const execute = require("../test-framework");
const {RuntimeError, CompileError} = require("../errors.js");

describe("Operators", () => {
  describe("Add", () => {
    it("Should add numbers and strings together", () => {
      let result = execute("scripts/operators/add.patpat");
      assert.equal(result, "10.5\n1028.75\nI like foxes\n");
    });
  });

  describe("Multiplication", () => {
    it("Should multiply numbers together and a repeat a string 9 times", () => {
      let result = execute("scripts/operators/mult.patpat");
      assert.equal(result, "9.5\nhadhadhadhadhadhadhadhadhad\n");
    });
  })
});
