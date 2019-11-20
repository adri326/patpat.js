const patpat = require("./patpat.js");

module.exports = function test(source) {
  let output = "";
  let stdout = {
    write: (str) => output += str
  };
  patpat(source, {
    stdout
  });
  return output;
}
