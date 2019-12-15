# patpat.js

*A PatPat interpreter written in JavaScript*

It is still a WIP.

## Installation

Clone this repository, and you'll be good to go!

## Usage

`/path/to/patpat.js/index.js <input-file> [--dump-tree]`

## Example

```patpat
'factorial: (n) => {
  #if(n > 0; () => {
    'factorial(n - 1) * n
  }; () => {
    1
  })
}

#for(0; 10; (x) => {
  'println('factorial(x))
})
```

## What is PatPat?

PatPat is an interpreted general-purpose language, whose objective is to make it easier to write code once and use it in several projects.
<!-- TODO: explain interpretations -->

Everything written in PatPat is made out of expressions. There are no `if`-blocks, nor `for` or `while`-blocks.
This lets PatPat's parser and interpreter be smaller and thus easier to maintain.

### Patterns

*Patterns* are in PatPat what *functions* are in most other languages.
In fact, a pattern is made out of a function:

```patpat
'pattern: (argument) => {
  // body
}
```

Patterns are prefixed by an apostrophe (`'`). Special patterns are prefixed by a hashtag (`#`), like `#if`.
This prefix makes it easier for the parser to deal with patterns and for the coder to read the code.

To call a pattern, follow its name by a tuple, containing the arguments to the pattern call.

```patpat
'pattern("I am the argument")
```

Functions are made out of [blocks](#blocks), which will return what the last instruction returns.

### Variables

Variables have to be declared with `let`. They are scoped.
They can be assigned a value using the assignement operator, `:`.

```patpat
let pi: 3.14
pi: 3.1415926535898
```

### Tuples

Tuples allow you to join values together.
They are denoted with two parentheses: `(...)`.

Elements within a tuple are separated by commas (`,`).

### Blocks

Blocks allow you to execute several instructions.
Blocks will return the return value of the last instruction.

### Structs

Structs allow you to assemble values together in a structured way.
They also allow you to define methods, which will perform actions on the values of a struct instance.

Structs are defined with the `struct` keyword and their name, whose first letter must be a capital letter:

```
Person: struct {
  let first_name
  let last_name
  let age

  'new: (first_name, last_name, age) => {
    self.first_name = first_name
    self.last_name = last_name
    self.age = age
  }

  'println: (#self()) => {
    'println(
      "Hello, I am " + self.first_name + " " + self.last_name + "!"
      + "I am " + self.age + " year"
      + #if(self.age > 1, "s", "") // handle plural properly
      + " old."
    )
  }
}
```

Methods need to have `#self()` as an arguments, whereas constructors don't.
Both of these kind of functions can access the current instance with `self`.

Fields have to be declared with the `let` keyword.

### Litterals

Here is a list of the different litterals that can be found in PatPat:

* Boolean litterals - `true` and `false`
* Numerical litterals - `1`, `2.45`, `-0.54398`
* String litterals - `"Hello, world!"`
* Function litterals - `(name) => {'println("Hi, I'm " + name)}`

### Multi-file

Other PatPat scripts can be loaded with both the `#use("<path>")` and the `#load("<path>")` patterns.

If `path` starts with `./` or `../`, PatPat will load the script relative to the current script.
Otherwise, it will look into the different `lookup_dirs`, defined in the config file, for these scripts.

If `path` leads to a directory, PatPat will try to load a script named `main.patpat` in it.
Otherwise, it will simply load the script referred by it.

### Left-hand-side and #if, #else, #elseif

A special argument can be given to a function litteral's arguments, `#lhs()`.
This argument makes that function aware of what the instruction preceding it returned.
This value can then be accessed with the `lhs` variable.

This allows for tricks like detecting if the last instruction failed to execute its body, which is what the `#else` and `#elseif` patterns do:
`#if` will return a special value (which can be accessed with `#bail()`) if its condition is false.
`#else` will then only execute its body if it sees that the last returned value is `#bail()`.
`#elseif` does the same, but it adds another condition and will return `#bail()` if it is false.

```patpat
'and_if: (#lhs(), condition, fn) => {
  #if((lhs != #bail()) && condition, fn)
}

#if("crab" == "prawn", () => {
  'println("This makes no sense!")
})
'and_if(0 == 0, () => {
  'println("This won't be printed")
})

#if(2 == 1 + 1, () => {
  'println("This makes more sense!")
})
'and_if(3 == 1 + 2, () => {
  'println("This will be printed")
})
```

### Operator precedence

There is no operator precedence. You must use parentheses if you want to mix several operators together.
This is justified by the fact that the operators can be overloaded and it makes the parser smaller.

### Flow control

Flow control is done using the `#for`, `#while`, `#if`, `#else` and `#elseif` patterns:

* `#for(from, to, callback)` will execute `callback` with as value a variable varying from `from` to `to`. It will return `#bail()` if `callback` was never called.
* `#while(condition, callback)` will execute `callback` as long as `condition` yields true. It will return `#bail()` if `condition` yields false on the first iteration.
* `#if(condition, callback)` will only execute `callback` if `condition` is true. It will return `#bail()` otherwise.
* `#else(callback)` will only execute `callback` if the last instruction returned `#bail()`.
* `#elseif(condition, callback)` will only execute `callback` if the last instruction returned `#bail()` and `condition` is true.

### Formal definition

The formal definition can be looked [here](definition.md).
