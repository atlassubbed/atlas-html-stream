const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Transform } = require("stream");
const HtmlParser = require("../src/HtmlParser");
const { parse, theyBoth, theyBothWithPreserveWSOption } = require("./helpers");

describe("HtmlParser", function(){
  it("should create an instance of a stream Transform", function(){
    const parser = new HtmlParser();
    expect(parser).to.be.an.instanceOf(Transform)
  })
  describe("ignores trivial html files", function(done){
    it("should not capture any tokens from empty files", function(done){
      parse({name: "empty.html"}, (err, res) => {
        if (err) return done(err);
        expect(res.length).to.equal(0);
        done();
      })
    })
    theyBoth("should not capture any tokens from pure whitespace files", "empty-ws", function(res, done){
      expect(res.length).to.equal(0);
      done();
    })
  })
  describe("captures text nodes", function(){
    theyBoth("should collapse whitespace in raw text", "text", function(res, done){
      expect(res.length).to.equal(1);
      expect(res[0].text).to.equal("this is some text with lots of whitespace ...the end");
      done();
    })
    theyBoth("should capture nested text nodes", "text-nested", function(res, done){
      res = res.filter(d => "text" in d)
      expect(res.length).to.equal(5);
      res.forEach(({text}) => expect(text).to.equal("nowhitespace"));
      done()
    })
    theyBoth("should capture nested text nodes with whitespace", "text-nested-ws", function(res, done){
      res = res.filter(d => "text" in d)
      expect(res.length).to.equal(4);
      res.forEach(({text}) => expect(text).to.equal("some nested text"));
      done()
    })
  })
  describe("captures names of html nodes", function(){
    theyBoth("should capture names of open/close tags", "name", function(res, done){
      expect(res.length).to.equal(2);
      res.forEach(({name}) => expect(name).to.equal("some-name"))
      done()
    });
    theyBoth("should ignore malformatted space around names of open/close tags", "name-ws", function(res, done){
      expect(res.length).to.equal(2);
      res.forEach(({name}) => expect(name).to.equal("some-name"))
      done()
    })
    theyBoth("should capture open+close tag name for self-closing tag", "name-selfclosing", function(res, done){
      expect(res.length).to.equal(2);
      res.forEach(({name}) => expect(name).to.equal("some-name"))
      done();
    })
    theyBoth("should ignore malformatted space around names of self-closing tags", "name-selfclosing-ws", function(res, done){
      expect(res.length).to.equal(2);
      res.forEach(({name}) => expect(name).to.equal("some-name"))
      done();
    })
  })
  // this parser is not responsible for discerning `true` keys or other non-string literal keys
  // will leave as a burden for the caller.
  describe("captures attributes in html nodes", function(){
    theyBoth("should capture bare keys as an empty string", "key-bare", function(res, done){
      res = res.filter(d => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({"some-key": ""});
      done();
    })
    theyBoth("should ignore malformatted whitespace around bare keys", "key-bare-ws", function(res, done){
      res = res.filter(d => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({"some-key": ""});
      done();
    })
    theyBoth("should capture unquoted values as strings", "key-val", function(res, done){
      res = res.filter(d => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({
        "some-key": "false",
        "another-key": "24",
        "a-key": "null"
      });
      done();
    })
    theyBoth("should ignore malformatted whitespace around unquoted values", "key-val-ws", function(res, done){
      res = res.filter(d => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({
        "some-key": "false",
        "another-key": "24",
        "a-key": "null"
      });
      done();
    })
    theyBoth("should capture quoted values", "key-val-quotes", function(res, done){
      res = res.filter(d => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({
        "some-key": "some double quoted value",
        "another-key": "some single quoted value"
      });
      done();
    })
    theyBoth("should ignore malformatted whitespace around quoted values", "key-val-quotes-ws", function(res, done){
      res = res.filter(d => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({
        "some-key": "some double quoted value",
        "another-key": "some single quoted value"
      });
      done();
    })
  })
  describe("captures comment nodes", function(){
    theyBoth("should treat everything inside the node as raw text", "comment", function(res, done){
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({name: "!--", data: {}});
      expect(res[1].text).to.equal('this is a comment')
      expect(res[2]).to.deep.equal({name: "!--"})
      done();
    })
    theyBoth("should keep all whitespace inside the node", "comment-ws", function(res, done){
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({name: "!--", data: {}});
      expect(res[1].text).to.equal('\n  this\n  is\n  a\n  comment\n')
      expect(res[2]).to.deep.equal({name: "!--"})
      done();
    })
  })
  describe("captures script nodes", function(){
    theyBoth("should treat everything inside the node as raw text", "script", function(res, done){
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({name: "script", data: {}});
      expect(res[1].text).to.equal('const c = <Component key="value"/>; const x = "hello"')
      expect(res[2]).to.deep.equal({name: "script"})
      done();
    })
    theyBoth("should keep all whitespace inside the node", "script-ws", function(res, done){
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({name: "script", data: {}});
      expect(res[1].text).to.equal('\n  const c = <Component key="value"/>;\n  const x = "hello"\n')
      expect(res[2]).to.deep.equal({name: "script"})
      done();
    })
  })
  describe("captures style nodes", function(){
    theyBoth("should treat everything inside the node as raw text", "style", function(res, done){
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({name: "style", data: {}});
      expect(res[1].text).to.equal('h1 {color:red;} p {color:blue;} <oops this=is not=valid css="!"/>')
      expect(res[2]).to.deep.equal({name: "style"})
      done();
    })
    theyBoth("should keep all whitespace inside the node", "style-ws", function(res, done){
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({name: "style", data: {}});
      expect(res[1].text).to.equal('\n  h1 {color:red;}\n  p {color:blue;}\n  <oops this=is not=valid css="!"/>\n')
      expect(res[2]).to.deep.equal({name: "style"})
      done();
    })
  })
  describe("correctly parses complete html files", function(){
    theyBoth("should capture all the nodes", "app", function(res, done){
      expect(res.length).to.equal(45)
      expect(res).to.deep.equal([
        {name: "!DOCTYPE", data: {html: ""}},
        {name: "html", data: {}},
        {name: "head", data: {}},
        {text: "some actual text"},
        {name: "!--", data: {}},
        {text: " broken link "},
        {name: "!--"},
        {name: "link", data: {rel: "stylesheet", type: "text/css", href: "mystyle.css"}},
        {name: "meta", data: {name: "viewport", content: "width=device-width, initial-scale=1"}},
        {name: "title", data: {}},
        {text: "My App"},
        {name: "title"},
        {name: "style", data: {}},
        {text: "\n      p {\n        margin: 0 auto;\n      }\n    "},
        {name: "style"},
        {name: "script", data: {}},
        {text: '\n      alert("Click me!")\n    '},
        {name: "script"},
        {name: "head"},
        {name: "body", data: {}},
        {name: "h1", data: {style: "color:blue;margin-left:30px;"}},
        {text: "My Awesome App"},
        {name: "h1"},
        {text: "This Is My Body"},
        {name: "p", data: {}},
        {text: "Paragraph 1"},
        {name: "p"},
        {name: "p", data: {these: ""}},
        {text: "Trees"},
        {name: "p", data: {are: "definitely"}},
        {text: "Are"},
        {name: "p", data: {invalid: ""}},
        {text: "Cool"},
        {name: "p", data: {attributes: "", on:"", our: "paragraph tags"}},
        {text: "Right?"},
        {name: "p"},
        {name: "p"},
        {name: "!--", data: {}},
        {text: " \n          hello \n          world \n        "},
        {name: "!--"},
        {text: "some actual text"},
        {name: "p"},
        {name: "p"},
        {name: "body"},
        {name: "html"}
      ])
      done()
    })
  })
  describe("correctly cleans up state", function(){
    it("should not flush pending text if the stream hasn't ended", function(){
      let calledData = 0;
      const parser = new HtmlParser();
      parser.on("data", data => calledData++);
      parser.write("some pending text");
      expect(calledData).to.equal(0);
    })
    it("should flush pending text if the stream was ended", function(){
      let calledData = 0;
      const parser = new HtmlParser();
      parser.on("data", data => {
        calledData++;
        expect(data.text).to.equal("some pending text")
      });
      parser.end("some pending text");
      expect(calledData).to.equal(1);
    })
    it("should forget a pending node if reset is called", function(){
      let calledData = 0;
      const parser = new HtmlParser();
      parser.on("data", data => {
        if (++calledData === 1){
          expect(data.text).to.equal("some text")
        } else {
          expect(data.name).to.equal("p")
        }
      })
      parser.write("<di")
      parser.reset();
      parser.write("some text <p>")
      expect(calledData).to.equal(2)
    })
  })
  describe("preserve whitespace option", () => {
    theyBothWithPreserveWSOption("should preserve whitespace in raw text", "text", true, function(res, done){
      expect(res.length).to.equal(1);
      expect(res[0].text).to.contain("\n");
      expect(res[0].text).to.contain("  ");
      done();
    })
    theyBothWithPreserveWSOption("should capture all the nodes and whitespaces", "app", true, function(res, done){
      expect(res.length).to.equal(62)
      expect(res).to.eql([
        {name: "!DOCTYPE", data: {html: ""}},
        {text: "\n"},
        {name: "html", data: {}},
        {text: "\n  "},
        {name: "head", data: {}},
        {text: "\n    some actual text" },
        {name: "!--", data: {} },
        {text: " broken link " },
        {name: "!--" },
        {text: "\n    " },
        {name: "link", data: {rel: "stylesheet", type: "text/css", href: "mystyle.css"}},
        {text: "\n    "},
        {name: "meta", data: {name: "viewport", content: "width=device-width, initial-scale=1"}},
        {text: "\n    "},
        {name: 'title', data: {} },
        {text: "\n      My App\n    "},
        {name: "title" },
        {text: "\n    "},
        {name: "style", data: {}},
        {text: "\n      p {\n        margin: 0 auto;\n      }\n    "},
        {name: "style"},
        {text: "\n    "},
        {name: "script", data: {}},
        {text: '\n      alert("Click me!")\n    '},
        {name: "script"},
        {text: "\n  "},
        {name: "head"},
        {text: "\n  "},
        {name: 'body', data: {}},
        {text: "\n    "},
        {name: "h1", data: {style: "color:blue;margin-left:30px;"}},
        {text: "My Awesome App"},
        {name: "h1"},
        {text: "\n    This\n    Is\n    My\n    Body\n    "},
        {name: "p", data: {}},
        {text: "Paragraph 1"},
        {name: "p"},
        {text: "\n    "},
        {name: "p", data: {these: ""}},
        {text: "Trees\n      "},
        {name: "p", data: {are: "definitely"}},
        {text: "Are\n        "},
        {name: "p", data: {invalid: ""}},
        {text: 'Cool\n          ' },
        {name: "p", data: {attributes: "", on:"", our: "paragraph tags"}},
        {text: 'Right?\n          ' },
        {name: "p" },
        {text: "\n        "},
        {name: "p"},
        {text: "\n        "},
        {name: "!--", data: {}},
        {text: " \n          hello \n          world \n        "},
        {name: "!--"},
        {text: "some actual text\n      "},
        {name: "p"},
        {text: "\n    "},
        {name: "p"},
        {text: "\n  "},
        {name: "body"},
        {text: "\n"},
        {name: "html"},
        {text: "\n"}
      ])
      done()
    })
    it("should preserve all whitespace chars in text", function(){
      let calledData = "";
      const parser = new HtmlParser({preserveWS: true});
      parser.on("data", data => {
        if (data.text) calledData += data.text;
      });
      parser.end("Title:\r\n<b> Jan \r\n\t Bananberg</b>");
      expect(calledData).to.equal("Title:\r\n Jan \r\n\t Bananberg");
    })
    it("should preserve all whitespace chars in text across chunks", function(){
      let calledData = "";
      const parser = new HtmlParser({preserveWS: true});
      parser.on("data", data => {
        if (data.text) calledData += data.text;
      });
      parser.write("Title:\r");
      parser.write("\n<b> Jan \r");
      parser.write("\n\t Banan");
      parser.write("berg</b");
      parser.end(">");
      expect(calledData).to.equal("Title:\r\n Jan \r\n\t Bananberg");
    })
    theyBothWithPreserveWSOption("should ignore malformatted space around names of open/close tags", "name-ws", true, function(res, done){
      expect(res).to.eql([
        {text: "        "},
        {name: "some-name", data: {}},
        {text: " \n\n  "},
        {name: "some-name"},
        {text: "\n\n"}
      ]);
      done()
    })
  });
})
