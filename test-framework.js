const patpat = require("./patpat.js");
const path = require("path");

module.exports = function test(source) {
  let output = "";
  let stdout = {
    write: (str) => output += str
  };
  patpat(path.join(__dirname, `test/${source}`), {
    stdout,
    throwError: true
  });
  return output;
}
