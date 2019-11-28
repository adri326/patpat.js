# patpat.js

*A PatPat interpreter written in JavaScript*

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

This will print the factorials of the natural numbers from 0 to 9.

Some kind of tutorial should come in the future. If can have a look at its [formal definition](definition.md).
