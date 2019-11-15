const chalk = require("chalk");

class CompileError extends Error {
  constructor(message, line = null, char = null) {
    super(message);
    this.message = message;
    this.line = line;
    this.char = char;
  }

  toString() {
    return this.message + (this.line !== null && this.char !== null ? ` (at ${this.line + 1}:${this.char + 1})` : '');
  }

  print(lines) {
    // console.error('╷');
    // console.error('┴');
    console.error();
    console.error(chalk.underline('Compiletime Exception:'));
    console.error('┬');
    if (this.line !== null && this.char !== null) {
      console.error('├╴ ' + chalk.white(lines[this.line]));
      console.error('┊  ' + ' '.repeat(this.char) + '┗┉┉' + chalk.yellow(` at ${this.line + 1}:${this.char + 1}`));
      console.error('┊');
    }
    for (let line of this.message.split(/\n/g)) {
      console.error('├╌╌╴ ' + chalk.redBright(line));
    }
    console.error('╵');
  }
}

// TODO: not have any runtime errors. We're not here for that
class RuntimeError extends Error {
  constructor(message, line = null, char = null) {
    super(message);
    this.message = message;
    this.line = line;
    this.char = char;
  }

  toString() {
    return this.message + (this.line !== null && this.char !== null ? ` (at ${this.line + 1}:${this.char + 1})` : '');
  }

  print(lines) {
    if (this.line !== null && this.char !== null) {
      // console.error('╷');
      // console.error('┴');
      console.error();
      console.error(chalk.underline('Runtime Exception:'));
      console.error('┬');
      console.error('├╴ ' + chalk.white(lines[this.line]));
      console.error('┊  ' + ' '.repeat(this.char) + '┗┉┉' + chalk.yellow(` at ${this.line + 1}:${this.char + 1}`));
      console.error('┊');
      for (let line of this.message.split(/\n/g)) {
        console.error('├╌╌╴ ' + chalk.redBright(line));
      }
      console.error('╵');
    } else {
      console.error(chalk.redBright(this.message));
    }
  }
}

module.exports = {
  CompileError,
  RuntimeError
};
