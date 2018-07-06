# atlas-html-stream

A super fast html-parser stream that outputs tag, text and closing nodes.

[![Travis](https://img.shields.io/travis/atlassubbed/atlas-html-stream.svg)](https://travis-ci.org/atlassubbed/atlas-html-stream)

---

## install 

```
npm install --save atlas-html-stream
```

## why

I didn't like htmlparser2's streaming API and I wanted an html parser that collpased whitespace by default. I also wanted to see if I could write a faster parser. 

## performance

#### htmlparser-benchmark

The following benchmark was done on my local machine using [htmlparser-benchmark](https://github.com/AndreasMadsen/htmlparser-benchmark). Lower is better:

```
atlas-html-stream: 4.91208 ms/file ± 6.08846
htmlparser2: 7.06549 ms/file ± 5.09643
```

I only tested against htmlparser2 because it was the fastest stream-based parser. This benchmark uses the streaming interface of both parsers.

#### memory usage

A simple parser requires the body to be in memory, which can be game-breaking if your HTML is very large. This parser is a stream, and benefits from using chunked data. The basic idea is to keep track of the current chunk and anything from the previous chunk which spills over into the current chunk. For example, consider the following two chunks:

  1. `"first data chunk <di"`
  2. `"v>second chunk</div>"`

When the parser is done with the first chunk, it will recognize that it needs to hold onto `"<di"` and will only flush `"first chunk "` from memory. When the parser is done with the second chunk, it will flush everything from memory since there's no longer a pending node.

## examples 

Using this parser is really easy since it `extends` the stream interface -- all you need to do is pipe or write HTML to it and listen to `"data"` events:

### with piping

The stream interface is recommended, because it allows you to consume a constant amount of memory (regardless of HTML size):

```javascript
const { createReadStream } = require("fs");
const HtmlParser = require("atlas-html-stream");
const myHtmlFile = createReadStream("./index.html");

myHtmlFile.pipe(new HtmlParser()).on("data", ({name, data, text}) => {
  if (text){
    // is a text node
    console.log(text);
  } else if (name && data){
    // is an opening tag with potential attributes
    console.log(name, data)
  } else {
    // is a closing tag
    console.log(name)
  }
}).on("end", () => {
  console.log("parsed all html")
})

```

### without piping

This is not recommended unless you can afford to have your HTML exist entirely in memory. First, we'll write a small helper to abstract away the streaming interface:

```javascript
// helpers.js
const HtmlParser = require("atlas-html-stream");
const parser = new HtmlParser();

const parseHtml = html => {
  const nodes = [];
  parser.on("data", data => nodes.push(data))
  parser.write(html)
  // resets the parser back to vanilla state
  parser.reset();
  return nodes;
}

module.exports = { parseHtml };
```

Next, we'll use our helper to parse our in-memory html file:

```javascript
const { readFileSync } = require("fs");
const { parseHtml } = require("./helpers");
const file = readFileSync("./index.html");
const nodes = parseHtml(file);
// do what you want with the parsed nodes.
```

### comment, script and style nodes

The examples above show you how minimal the API is, as it should be. Comment, script and style nodes are treated as regular nodes, in that they emit opening and closing tags. The main difference is that the content inside these nodes is treated as a single raw text node with no whitespace-collapse. For simplicity, let's use our `parseHtml` helper function from above in the following examples:

#### script/style tags

```javascript
...
const scriptNodes = parseHtml(`
  <script src="./script.js">
    const myVar = 5;
  </script>
`);
scriptNodes.forEach(n => console.log(n))
// { name: 'script', data: { src: './script.js' } }
// { text: '\n    const myVar = 5;\n  ' }
// { name: 'script' }
```

Style tags are treated the same way, except their `name` property has a value of `"style"`.

#### comment tags

Again, these are treated the same way.

```javascript
const commentNodes = parseHtml(`
  <!-- 
    this is 
    a comment 
  -->
`)
commentNodes.forEach(n => console.log(n));
// { name: '!--', data: {} }
// { text: ' \n    this is \n    a comment \n  ' }
// { name: '!--' }
```

## todo

#### `parseHtml` helper

Should `parseHtml` be exported from this package in addition to `HtmlParser`? Using `parseHtml` is not recommended over the streaming interface, but it seems like a valid helper for cases where the html string needs to be in memory.

#### even faster

I'd like to make this thing even faster. The parsing itself takes about `3.5 ms/file` (using [htmlparser-benchmark](https://github.com/AndreasMadsen/htmlparser-benchmark)) on my machine. Pushing nodes as `data` events to our stream adds around 40% more processing time, which is why the benchmark above shows around `4.9 ms/file` -- this can't be avoided, because we *want* the streaming interface. 

The `SeqMatcher` slows down this parser (checking comment, script and style nodes); there might be a faster way to handle these special nodes.

Switching on the `state` of the parser first is probably faster than switching on the current character first, but I haven't tested the latter. The main idea is to minimize the amount of instructions required for each `[state, char]` pair, according to how likely each pair is. If `[TEXT, !whitespace]` has the highest probability in "typical" html, then we would want this pair to require the least amount of instructions. In other words, `sum_i(probabilityOfPair_i*numSteps_i)` should be minimized.

#### dynamic parser idea

What defines a "typical" html document? A set of parsing instructions for a "typical" html document may be slower for "atypical" html documents which have a vastly different `probabilityOfPair_i` distribution. What if the parser could use the distribution of pairs of the current document to dynamically change its condition-tree on-the-fly? For example, if we're getting overwhelmed by raw text, it would be faster to check if the state is `TEXT` first. Alternatively, if our document has almost *no* raw text, it would be smarter to check if the state is `TEXT` last. While the dynamic parser sounds interesting, it may not be worth implementing if it adds a ton of overhead.

## caveats

#### large text nodes

Since the parser keeps pending nodes' data in memory, a large text node will cause memory issues. In the vast majority of cases, you will not run into text nodes bigger than the chunks themselves. If this becomes a problem, the parser could be modified to accept a `maxTextSize` parameter which it could use to chunk the individual text nodes themselves. For now, this is an extreme edge case and isn't handled.

#### doctype

The doctype node is treated as any other node. The input `"<!DOCTYPE html>"` would result in the following data event: `{name: "!DOCTYPE", data: {html: ""}}`

#### attributes with no value

Tag attributes with no value are not treated in a special way; a key with no value will have an empty string value in the node's data field. I may implement `true` as the default value, but this seems like something that can easily be done by the caller.
