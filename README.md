# atlas-html-stream

A super fast html-parser stream that outputs tag, text and closing nodes.

[![Travis](https://img.shields.io/travis/atlassubbed/atlas-html-stream.svg)](https://travis-ci.org/atlassubbed/atlas-html-stream)

---

## why

I didn't like htmlparser2's streaming API and I wanted an html parser that collpased whitespace by default. I also wanted to see if I could write a faster parser. 

## performance

#### htmlparser-benchmark

The following benchmark was done on my local machine using [htmlparser-benchmark](https://github.com/AndreasMadsen/htmlparser-benchmark). Lower is better:

```
atlas-html-stream: 4.91208 ms/file ± 6.08846
htmlparser2: 7.06549 ms/file ± 5.09643
```

I only tested against htmlparser2 because it was the fastest stream-based parser.

#### memory usage

A simple parser requires the body to be in memory, which can be game-breaking if your HTML is very large. This parser is a stream, and benefits from using chunked data. The basic idea is to keep track of the current chunk and anything from the previous chunk which spills over into the current chunk. For example, consider the following two chunks:

  1. `"first data chunk <di"`
  2. `"v>second chunk</div>"`

When the parser is done with the first chunk, it will recognize that it needs to hold onto `"<di"` and will only flush `"first chunk "` from memory. When the parser is done with the second chunk, it will flush everything from memory since there's no longer a pending node.

## examples 

Using this parser is really easy since it `extends` the stream interface -- all you need to do is pipe or write HTML to it.

```javascript
// todo
```

## caveats

#### text nodes

Since the parser keeps pending nodes' data in memory, a large text node will cause memory issues. In the vast majority of cases, you will not run into text nodes bigger than the chunks themselves. If this becomes a problem, the parser could be modified to accept a `maxTextSize` parameter and use it to chunk the individual text nodes themselves.

#### comment, script and style nodes

Comments, script and style nodes are all just nodes, so they emit opening and closing tags. Anything inside these nodes is treated as a single text node with no whitespace-collapse. The input `"<script>const x = 4</script>"` would create the following three data events:

  1. `{name: "script", data:{}}`
  2. `{text: "const x = 4"}`
  3. `{name: "script"}`

Style and comment nodes are treated the same way, except their `name`s are `"style"` and `"!--", respectively.

#### doctype

The doctype node is treated as any other node. The input `"<!DOCTYPE html>"` would result in the following data event: `{name: "!DOCTYPE", data: {html: ""}}`

#### attributes with no value

Tag attributes with no value are not treated in a special way; a key with no value will have an empty string value in the node's data field. I may implement `true` as the default value, but this seems like something that can be done by the caller.
