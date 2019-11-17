# patpat.js

*A PatPat interpreter written in JavaScript*

## Installation

Clone this repository, and you'll be good to go!

## Usage

`/path/to/patpat.js/index.js <input-file> [--dump-tree]`

## Example

```
'factorial: (n) => {
  #if(n; () => {
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
More explanation & such to go.
