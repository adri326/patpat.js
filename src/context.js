const Context = module.exports = class Context {
  constructor(symbols = {}, patterns = {}, structs = {}, last_value) {
    this.symbols = symbols;
    this.patterns = patterns;
    this.structs = structs;
    this.last_value = last_value;
  }

  tail(context_stack) {
    return [...context_stack, this];
  }
}
