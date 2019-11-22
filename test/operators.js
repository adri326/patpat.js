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
  });

  describe("Substraction", () => {
    it("Should substract two numbers together", () => {
      let result = execute("scripts/operators/sub.patpat");
      assert.equal(result, "1.625\n-9\n");
    });
  });

  describe("Modulo", () => {
    it("Should calculate the remainder between two numbers", () => {
      let result = execute("scripts/operators/mod.patpat");
      assert.equal(result, "2\n-5\n");
    });
  });

  describe("Division", () => {
    it("Should divide two numbers together", () => {
      let result = execute("scripts/operators/div.patpat");
      assert.equal(result, "0.75\n3\n");
    });

    // it("Should return 0 when dividing by zero", () => {
    //   assert.equal(execute("scripts/operators/div-0.patpat"), "0");
    // });
  });

  describe("Equalities", () => {
    it("Should test the equality between numbers, strings and objects", () => {
      execute("./scripts/operators/equal.patpat");
    });
  });

  it("Should not allow operator precedence", () => {
    assert.throws(() => {
      execute("scripts/operators/precedence.patpat");
    }, CompileError);
  });
});
