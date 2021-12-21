"use strict";

const { describe, it } = require("mocha");
const { EOL } = require("os");
const { expect } = require("chai");
const { parse, theyBoth, theyBothWithPreserveWSOption } = require("./helpers");
const { Transform } = require("stream");
const HtmlParser = require("../src/HtmlParser");

describe("HtmlParser", () => {
  it("should create an instance of a stream Transform", () => {
    const parser = new HtmlParser();
    expect(parser).to.be.an.instanceOf(Transform);
  });
  describe("ignores trivial html files", () => {
    it("should not capture any tokens from empty files", (done) => {
      parse({ name: "empty.html" }, (err, res) => {
        if (err) return done(err);
        expect(res.length).to.equal(0);
        done();
      });
    });
    theyBoth("should not capture any tokens from pure whitespace files", "empty-ws", (res, done) => {
      expect(res.length).to.equal(0);
      done();
    });
  });
  describe("captures text nodes", () => {
    theyBoth("should collapse whitespace in raw text", "text", (res, done) => {
      expect(res.length).to.equal(1);
      expect(res[0].text).to.equal("this is some text with lots of whitespace ...the end");
      done();
    });
    theyBoth("should capture nested text nodes", "text-nested", (res, done) => {
      res = res.filter((d) => "text" in d);
      expect(res.length).to.equal(5);
      res.forEach(({ text }) => expect(text).to.equal("nowhitespace"));
      done();
    });
    theyBoth("should capture nested text nodes with whitespace", "text-nested-ws", (res, done) => {
      res = res.filter((d) => "text" in d);
      expect(res.length).to.equal(4);
      res.forEach(({ text }) => expect(text).to.equal("some nested text"));
      done();
    });
  });
  describe("captures names of html nodes", () => {
    theyBoth("should capture names of open/close tags", "name", (res, done) => {
      expect(res.length).to.equal(2);
      res.forEach(({ name }) => expect(name).to.equal("some-name"));
      done();
    });
    theyBoth("should ignore malformatted space around names of open/close tags", "name-ws", (res, done) => {
      expect(res.length).to.equal(2);
      res.forEach(({ name }) => expect(name).to.equal("some-name"));
      done();
    });
    theyBoth("should capture open+close tag name for self-closing tag", "name-selfclosing", (res, done) => {
      expect(res.length).to.equal(2);
      res.forEach(({ name }) => expect(name).to.equal("some-name"));
      done();
    });
    theyBoth("should ignore malformatted space around names of self-closing tags", "name-selfclosing-ws", (res, done) => {
      expect(res.length).to.equal(2);
      res.forEach(({ name }) => expect(name).to.equal("some-name"));
      done();
    });
  });
  // this parser is not responsible for discerning `true` keys or other non-string literal keys
  // will leave as a burden for the caller.
  describe("captures attributes in html nodes", () => {
    theyBoth("should capture bare keys as an empty string", "key-bare", (res, done) => {
      res = res.filter((d) => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({ "some-key": "" });
      done();
    });
    theyBoth("should ignore malformatted whitespace around bare keys", "key-bare-ws", (res, done) => {
      res = res.filter((d) => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({ "some-key": "" });
      done();
    });
    theyBoth("should capture unquoted values as strings", "key-val", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({
        name: "name",
        data: {
          "some-key": "false",
          "another-key": "24",
          "a-key": "null",
          src: "/atlassubbed/atlas-html-stream/",
        },
      });
      expect(res[1]).to.deep.equal({
        name: "name",
        data: {
          src: "/atlassubbed/atlas-html-stream",
        },
      });
      expect(res[2]).to.deep.equal({
        name: "name",
      });
      done();
    });
    theyBoth("should ignore malformatted whitespace around unquoted values", "key-val-ws", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({
        name: "name",
        data: {
          "some-key": "false",
          "another-key": "24",
          "a-key": "null",
          src: "/atlassubbed/atlas-html-stream/",
        },
      });
      expect(res[1]).to.deep.equal({
        name: "name",
        data: {
          src: "/atlassubbed/atlas-html-stream",
        },
      });
      expect(res[2]).to.deep.equal({
        name: "name",
      });
      done();
    });
    theyBoth("should capture quoted values", "key-val-quotes", (res, done) => {
      res = res.filter((d) => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({
        "some-key": "some double quoted value",
        "another-key": "some single quoted value",
      });
      done();
    });
    theyBoth("should ignore malformatted whitespace around quoted values", "key-val-quotes-ws", (res, done) => {
      res = res.filter((d) => d.data);
      expect(res.length).to.equal(1);
      expect(res[0].data).to.deep.equal({
        "some-key": "some double quoted value",
        "another-key": "some single quoted value",
      });
      done();
    });
  });
  describe("captures comment nodes", () => {
    theyBoth("should treat everything inside the node as raw text", "comment", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({ name: "!--", data: {} });
      expect(res[1].text).to.equal("this is a comment");
      expect(res[2]).to.deep.equal({ name: "!--" });
      done();
    });
    theyBoth("should keep all whitespace inside the node", "comment-ws", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({ name: "!--", data: {} });
      expect(res[1].text).to.equal(`${EOL}  this${EOL}  is${EOL}  a${EOL}  comment${EOL}`);
      expect(res[2]).to.deep.equal({ name: "!--" });
      done();
    });
  });
  describe("captures script nodes", () => {
    theyBoth("should treat everything inside the node as raw text", "script", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({ name: "script", data: {} });
      expect(res[1].text).to.equal('const c = <Component key="value"/>; const x = "hello"');
      expect(res[2]).to.deep.equal({ name: "script" });
      done();
    });
    theyBoth("should keep all whitespace inside the node", "script-ws", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({ name: "script", data: {} });
      expect(res[1].text).to.equal(`${EOL}  const c = <Component key="value"/>;${EOL}  const x = "hello"${EOL}`);
      expect(res[2]).to.deep.equal({ name: "script" });
      done();
    });
    theyBoth("should return empty script", "empty-script", (res, done) => {
      expect(res.length).to.equal(2);
      expect(res[0]).to.deep.equal({ name: "script", data: {} });
      expect(res[1]).to.deep.equal({ name: "script" });
      done();
    });
  });
  describe("captures style nodes", () => {
    theyBoth("should treat everything inside the node as raw text", "style", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({ name: "style", data: {} });
      expect(res[1].text).to.equal('h1 {color:red;} p {color:blue;} <oops this=is not=valid css="!"/>');
      expect(res[2]).to.deep.equal({ name: "style" });
      done();
    });
    theyBoth("should keep all whitespace inside the node", "style-ws", (res, done) => {
      expect(res.length).to.equal(3);
      expect(res[0]).to.deep.equal({ name: "style", data: {} });
      expect(res[1].text).to.equal(`${EOL}  h1 {color:red;}${EOL}  p {color:blue;}${EOL}  <oops this=is not=valid css="!"/>${EOL}`);
      expect(res[2]).to.deep.equal({ name: "style" });
      done();
    });
  });
  describe("captures self close nodes", () => {
    theyBoth("should close self closing nodes", "self-closing", (res, done) => {
      expect(res.length).to.equal(2);
      expect(res[0]).to.deep.equal({ name: "input", data: { id: "foo", disabled: "" } });
      expect(res[1]).to.deep.equal({ name: "input" });
      done();
    });
  });
  describe("correctly parses complete html files", () => {
    theyBoth("should capture all the nodes", "app", (res, done) => {
      expect(res.length).to.equal(45);
      expect(res).to.deep.equal([
        { name: "!DOCTYPE", data: { html: "" } },
        { name: "html", data: {} },
        { name: "head", data: {} },
        { text: "some actual text" },
        { name: "!--", data: {} },
        { text: " broken link " },
        { name: "!--" },
        { name: "link", data: { rel: "stylesheet", type: "text/css", href: "mystyle.css" } },
        { name: "meta", data: { name: "viewport", content: "width=device-width, initial-scale=1" } },
        { name: "title", data: {} },
        { text: "My App" },
        { name: "title" },
        { name: "style", data: {} },
        { text: `${EOL}      p {${EOL}        margin: 0 auto;${EOL}      }${EOL}    ` },
        { name: "style" },
        { name: "script", data: {} },
        { text: `${EOL}      alert("Click me!")${EOL}    ` },
        { name: "script" },
        { name: "head" },
        { name: "body", data: {} },
        { name: "h1", data: { style: "color:blue;margin-left:30px;" } },
        { text: "My Awesome App" },
        { name: "h1" },
        { text: "This Is My Body" },
        { name: "p", data: {} },
        { text: "Paragraph 1" },
        { name: "p" },
        { name: "p", data: { these: "" } },
        { text: "Trees" },
        { name: "p", data: { are: "definitely" } },
        { text: "Are" },
        { name: "p", data: { invalid: "" } },
        { text: "Cool" },
        { name: "p", data: { attributes: "", on: "", our: "paragraph tags" } },
        { text: "Right?" },
        { name: "p" },
        { name: "p" },
        { name: "!--", data: {} },
        { text: ` ${EOL}          hello ${EOL}          world ${EOL}        ` },
        { name: "!--" },
        { text: "some actual text" },
        { name: "p" },
        { name: "p" },
        { name: "body" },
        { name: "html" },
      ]);
      done();
    });
  });
  describe("correctly cleans up state", () => {
    it("should not flush pending text if the stream hasn't ended", () => {
      let calledData = 0;
      const parser = new HtmlParser();
      parser.on("data", () => calledData++);
      parser.write("some pending text");
      expect(calledData).to.equal(0);
    });
    it("should flush pending text if the stream was ended", () => {
      let calledData = 0;
      const parser = new HtmlParser();
      parser.on("data", (data) => {
        calledData++;
        expect(data.text).to.equal("some pending text");
      });
      parser.end("some pending text");
      expect(calledData).to.equal(1);
    });
    it("should forget a pending node if reset is called", () => {
      let calledData = 0;
      const parser = new HtmlParser();
      parser.on("data", (data) => {
        if (++calledData === 1){
          expect(data.text).to.equal("some text");
        } else {
          expect(data.name).to.equal("p");
        }
      });
      parser.write("<di");
      parser.reset();
      parser.write("some text <p>");
      expect(calledData).to.equal(2);
    });
  });
  describe("preserve whitespace option", () => {
    theyBothWithPreserveWSOption("should preserve whitespace in raw text", "text", true, (res, done) => {
      expect(res.length).to.equal(1);
      expect(res[0].text).to.contain(EOL);
      expect(res[0].text).to.contain("  ");
      done();
    });
    theyBothWithPreserveWSOption("should capture all the nodes and whitespaces", "app", true, (res, done) => {
      expect(res.length).to.equal(62);
      expect(res).to.eql([
        { name: "!DOCTYPE", data: { html: "" } },
        { text: EOL },
        { name: "html", data: {} },
        { text: `${EOL}  ` },
        { name: "head", data: {} },
        { text: `${EOL}    some actual text` },
        { name: "!--", data: {} },
        { text: " broken link " },
        { name: "!--" },
        { text: `${EOL}    ` },
        { name: "link", data: { rel: "stylesheet", type: "text/css", href: "mystyle.css" } },
        { text: `${EOL}    ` },
        { name: "meta", data: { name: "viewport", content: "width=device-width, initial-scale=1" } },
        { text: `${EOL}    ` },
        { name: "title", data: {} },
        { text: `${EOL}      My App${EOL}    ` },
        { name: "title" },
        { text: `${EOL}    ` },
        { name: "style", data: {} },
        { text: `${EOL}      p {${EOL}        margin: 0 auto;${EOL}      }${EOL}    ` },
        { name: "style" },
        { text: `${EOL}    ` },
        { name: "script", data: {} },
        { text: `${EOL}      alert("Click me!")${EOL}    ` },
        { name: "script" },
        { text: `${EOL}  ` },
        { name: "head" },
        { text: `${EOL}  ` },
        { name: "body", data: {} },
        { text: `${EOL}    ` },
        { name: "h1", data: { style: "color:blue;margin-left:30px;" } },
        { text: "My Awesome App" },
        { name: "h1" },
        { text: `${EOL}    This${EOL}    Is${EOL}    My${EOL}    Body${EOL}    ` },
        { name: "p", data: {} },
        { text: "Paragraph 1" },
        { name: "p" },
        { text: `${EOL}    ` },
        { name: "p", data: { these: "" } },
        { text: `Trees${EOL}      ` },
        { name: "p", data: { are: "definitely" } },
        { text: `Are${EOL}        ` },
        { name: "p", data: { invalid: "" } },
        { text: `Cool${EOL}          ` },
        { name: "p", data: { attributes: "", on: "", our: "paragraph tags" } },
        { text: `Right?${EOL}          ` },
        { name: "p" },
        { text: `${EOL}        ` },
        { name: "p" },
        { text: `${EOL}        ` },
        { name: "!--", data: {} },
        { text: ` ${EOL}          hello ${EOL}          world ${EOL}        ` },
        { name: "!--" },
        { text: `some actual text${EOL}      ` },
        { name: "p" },
        { text: `${EOL}    ` },
        { name: "p" },
        { text: `${EOL}  ` },
        { name: "body" },
        { text: EOL },
        { name: "html" },
        { text: EOL },
      ]);
      done();
    });
    theyBothWithPreserveWSOption("should preserve all whitespace chars in text", "regular-ws", true, (res, done) => {
      expect(res).to.eql([
        { text: `Title:\t${EOL}` },
        { name: "b", data: {} },
        { text: ` Jan \t${EOL}\t Bananberg` },
        { name: "b" },
        { text: EOL },
      ]);
      done();
    });
    theyBothWithPreserveWSOption("should ignore malformatted space around names of open/close tags", "name-ws", true, (res, done) => {
      expect(res).to.eql([
        { text: "        " },
        { name: "some-name", data: {} },
        { text: ` ${EOL}${EOL}  ` },
        { name: "some-name" },
        { text: `${EOL}${EOL}` },
      ]);
      done();
    });
  });
});
