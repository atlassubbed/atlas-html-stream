# atlas-html-stream

A super fast html-parser stream that outputs tag, text and closing nodes.

[![Travis](https://img.shields.io/travis/atlassubbed/atlas-html-stream.svg)](https://travis-ci.org/atlassubbed/atlas-html-stream)

---

## why

I didn't like htmlparser2's streaming API and I wanted an html parser that collpased whitespace by default. I also wanted to see if I could write a faster parser. The following benchmark was done on my local machine using [htmlparser-benchmark](https://github.com/AndreasMadsen/htmlparser-benchmark). Lower is better:

```
atlas-html-stream: 4.91208 ms/file ± 6.08846
htmlparser2: 7.06549 ms/file ± 5.09643
```

I only tested against htmlparser2 because it was the fastest stream-based parser.

## examples

Todo.