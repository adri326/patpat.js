

const Context = module.exports = class Context {
  constructor(symbols = {}, patterns = {}, structs = {}) {
    this.symbols = symbols;
    this.patterns = patterns;
    this.structs = structs;
    this.last_value = null;
  }

  tail(context_stack) {
    return [...context_stack, this];
  }
}
