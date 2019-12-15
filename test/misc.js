const {assert} = require("chai");
const execute = require("../src/test-framework");
const {RuntimeError, CompileError} = require("../src/errors.js");

describe("Miscellaneous", () => {
  it("Should not call 'println if there is a comma between 'println and the 'arguments' tuple", () => {
    let result = execute("scripts/misc/querky-call.patpat");
    assert.equal(result, "");
  });

  it("Should make #lhs() access the value returned by the previous instruction", () => {
    let result = execute("scripts/misc/lhs.patpat");
    assert.equal(result, "I am free!\n2 < 3\n4 = 4\n6 > -1\n");
  });
});
