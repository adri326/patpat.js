# PatPat's language definition

This is a formal definition of the patpat language. It only describes its grammar and syntax.

Formal grammar in this file uses [Extended Backus-Naur Form](https://en.wikipedia.org/wiki/Extended_Backus–Naur_form).
A PatPat script source file consists of a `BLOCK_BODY`.

These are the usual nonterminals used throughout this file:

```ebnf
whitespace = " ", {" "};
lowercase_letter = "a" | "b" | ... | "z";
uppercase_letter = "A" | "B" | ... | "Z";
digits = digit, {digits};
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
all_characters = ? all characters ?;

DEFINE = ":";
```

## Number

```ebnf
NUMBER = ["-"], digits, {".", digits};
```

**e.g:** `72`, `-9.2`, `0.1205`

## String

```ebnf
STRING = '"', {string-token}, '"';
string_token = "\\n" | '\\"' | (all_characters - '"'); (* All the non-trema characters *)
```

**e.g:** `"I am \n\"glad" to meet you."`

## Booleans

```ebnf
BOOLEAN = "true" | "false";
```

## Symbols

These are variable names.

```ebnf
SYMBOL = (lowercase_letter | "_"), {lowercase_letter | "_" | digit};
```

**e.g:** `last_value`, `chocolatine_or_pain_au_chocolat`, `r2d2`

### Symbol definitions

Allows you to put a value in a symbol.

```ebnf
DEFINE_SYMBOL = SYMBOL, {whitespace}, DEFINE, {whitespace}, EXPRESSION;
```

**e.g:** `is_toaster: true`

### Symbol declarations

```ebnf
DECLARE_SYMBOL = "let", whitespace, {whitespace}, SYMBOL, [DEFINE, {whitespace}, EXPRESSION];
```

**e.g:** `let is_toaster: false`, `let happiness`

## Patterns

The equivalent to functions. They are differentiated form symbols thanks to their `'` or `#` prefix.
They can be called and given arguments.

```ebnf
PATTERN = ("'" | "#"), SYMBOL;
```

**e.g:** `'println`

### Pattern calls

A call to a pattern.

```ebnf
PATTERN_CALL = PATTERN, {whitespace}, TUPLE;
```

**e.g:** `'println("Petit pain au chocolat")`

### Pattern definition

Where patterns are born.

```ebnf
PATTERN_DEFINITION = PATTERN, {whitespace}, DEFINE, {whitespace}, FUNCTION;
```

**e.g:** `'move_hanoi: (from, to, using) => {...}`

## Tuples

Tuples are list-like, static-lengthed objects, which store a finite and set amount of fields.
They can also be empty.

```ebnf
TUPLE = "(", {whitespace}, tuple-contents, {whitespace}, ")" | "()";
tuple_contents = tuple_token, {{whitespace}, (SEPARATOR | NEXT_ELEMENT), {whitespace}, tuple_token};
tuple_token = EXPRESSION | FUNCTION;
```

**e.g:** `(-0.5; 0.5)`, `()`

### Next elements and seperators

Next elements tell tuples that what is coming next is part of another field on that tuple.
Separators allow multiple instructions to be executed for a single field. The last one's value will be retained.

```ebnf
NEXT_ELEMENT = ";"
SEPARATOR = ","
```

**e.g:** `(2, 3)` will return the same as `(3)`.

*Note:* it is hard to get the hang of it, and might sound like a bad idea. Whatever your opinion is, you should feel free to fork this project and make it fit better to what is good or bad to you.

## Functions

Functions have a set of arguments of a body. When and only when they are *called*, their bodies get executed with the argument's values stored on the context stack.

```ebnf
ARG_TUPLE = "(", {whitespace}, arg-tuple-contents, {whitespace}, ")" | "()";
arg_tuple_contents = arg_tuple_token, {{whitespace}, NEXT_ELEMENT, {whitespace}, arg_tuple_token};
arg_tuple_token = SYMBOL | "#self()" | "#opt(", SYMBOL, ")";
FUNCTION = ARG_TUPLE, {whitespace}, "=>", {whitespace}, BLOCK;
```

**e.g:** `(number_of_cats) => {'println("I have", number_of_cats, "cats")}`

### Function calls

*Calls* a function with the given arguments.

```ebnf
FUNCTION_CALL = (TUPLE | SYMBOL | FUNCTION_CALL), {whitespace}, TUPLE;
```

**e.g:** `'i_have_n_cats(36)`

## Structs

Structs bundle fields (`MEMBER`s) and methods (`METHOD`s) together.
They are later on instanced.

```ebnf
STRUCT = TYPENAME, {whitespace}, DEFINE, {whitespace}, "struct", {whitespace}, BLOCK;
```

**e.g:**

```patpat
Cat: struct {
  let hunger

  'new: () => {
    self.hunger = 0;
  }
}
```

### Typenames

This are simply names for structs, that are `PascalCased`.

```ebnf
TYPENAME = (uppercase_letter | "_"), {uppercase_letter | "_" | lowercase_letter | digit};
```

**e.g:** `Cat`, `ParsedTree`

### Struct initializations

Creates new struct instances.

```ebnf
STRUCT_INIT = TYPENAME, {whitespace}, ".", {whitespace}, PATTERN, {whitespace}, TUPLE;
```

**e.g:** `Cat.'new()`

### Member definitions

Member definitions allow the programmer to write value to struct fields.

```ebnf
MEMBER_DEFINE = (SYMBOL | TUPLE | FUNCTION_CALL | PATTERN_CALL | STRUCT_INIT), SYMBOL, {whitespace}, "=", {whitespace}, EXPRESSION;
```

## Complex definitions

These definitions allow tuple destructuring (`let (a; b) = (1; 2)`) and function and pattern setters (`array(index): value`).

```ebnf
DEFINE_COMPLEX = (TUPLE | FUNCTION_CALL | PATTERN_CALL), {whitespace}, DEFINE, {whitespace}, EXPRESSION;
```

## Blocks

Blocks are where instructions are executed.
They contain a list of instructions, which will be executed one after the other.

These instructions are separated either with newlines, or a `NEXT_ELEMENT`.

Their return value is that of the last instruction.

```ebnf
BLOCK_EXPRESSIONS = DECLARE_SYMBOL | DEFINE_PATTERN | STRUCT | "";
BLOCK_BODY = {{whitespace}, [EXPRESSION | BLOCK_EXPRESSIONS], {whitespace}, (NEXT_ELEMENT | "\n")};
BLOCK = "{", BLOCK_BODY, "}";
```

**e.g:**

```patpat
{
  instruction_1;
  instruction_2
  instruction_3
}
```

## Expressions

Expressions represent mathematical transformations, like adding two numbers together.
While pretty much anything in PatPat can be an expression, expressions are only presented to the interpreted when they are needed, that is, when an `OPERATOR` is present.
The rest of the time, function calls, pattern calls, struct definitions and other instructions are stored and executed as-is.

```ebnf
VALID_EXP_TERM = STRING
  | NUMBER
  | BOOLEAN
  | ARRAY
  | SYMBOL
  | TUPLE
  | FUNCTION_CALL
  | PATTERN_CALL
  | EXPRESSION
  | MEMBER_ACCESSOR
  | STRUCT_INIT
  | DEFINE_MEMBER
  | DEFINE_SYMBOL
  | DEFINE_COMPLEX
  | BLOCK;

UNARY_EXPRESSION = {UNARY_OPERATOR, {whitespace}}, VALID_EXP_TERM;
EXPRESSION = UNARY_EXPRESSION, {{whitespace}, BINARY_OPERATOR, {whitespace}, UNARY_EXPRESSION};
```

**e.g:** `2 + 4`, `true != false`

### Operators

```ebnf
UNARY_OPERATOR = "!" | "-";
BINARY_OPERATOR = "+" | "-" | "*" | "/" | "<" | ">" | "<=" | "=>" | "==" | "!=" | "%" | "&&" | "||";
OPERATOR = UANRY_OPERATOR | BINARY_OPERATOR;
```
