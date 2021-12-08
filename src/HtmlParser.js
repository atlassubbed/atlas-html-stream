const { Transform } = require("stream");
const { TEXT, NODE, NAME, KEY, VALUE, SCRIPT, STYLE, COMMENT } = require("./states");

class SeqMatcher {
  constructor(str) {
    this.str = str;
    this.max = str.length - 1;
    this.pos = 0;
  }
  found(code) {
    if (code !== this.str.charCodeAt(this.pos)) return !!(this.pos = 0);
    if (this.pos === this.max) return !(this.pos = 0);
    return !++this.pos;
  }
  reset() {
    return !(this.pos = 0);
  }
}

module.exports = class HtmlParser extends Transform {
  constructor({preserveWS} = {preserveWS: false}){
    super({readableObjectMode: true})
    this.preserveWS = preserveWS;
    this.endScript = new SeqMatcher("</script>")
    this.endStyle = new SeqMatcher("</style>")
    this.beginComment = new SeqMatcher("!--")
    this.endComment = new SeqMatcher("-->")

    this.curPos = 0;
    this.minPos = 0;
    this.state = TEXT;

    this.cache = "";
    this.name = "";
    this.key = "";
    this.text = [];
    this.data = {};

    this.flags = {
      isClose: null,
      isSelfClose: null,
      hasEqual: null,
      valStartChar: null,
    };
  }
  _transform(chunk, encoding, done){
    if (chunk === null) return this.end();
    this.parse(this.addToCache(chunk));
    done(null)
  }
  _flush(done){
    this.flushAllText();
    this.reset();
    done(null)
  }
  parse(cacheLen) {
    let i = this.curPos, v = this.minPos, s = this.state, c
    while (i < cacheLen){
      c = this.cache.charCodeAt(i)
      if (s === TEXT){
        if (!this.preserveWS && (c === 32 || c >= 9 && c <= 13)) // ws
          v < i && this.text.push(this.getCache(v, i)), v = i + 1
        else if (c === 60) // <
          this.flushText(v, i), s = NODE, v = i + 1
      } else if (s === NODE){
        if (c === 62) // >
          this.key && this.flushKey(), s = this.flushNode(), v = i + 1
        else if (c === 47 && !this.flags.hasEqual) // /
          this.flags.isClose = !(this.flags.isSelfClose = !!this.name)
        else if (c !== 32 && (c < 9 || c > 13)){ // !ws
          if (!this.name) // name start
            this.beginComment.found(c), v = i, s = NAME
          else if (!this.key) // key start
            v = i, s = KEY
          else if (c === 61) // =
            this.flags.hasEqual = true
          else if (!this.flags.hasEqual) // next key
            this.flushKey(), v = i, s = KEY
          else if (c === 34 || c === 39) // ', "
            v = i + 1, this.flags.valStartChar = c, s = VALUE
          else // un-quoted val
            v = i, s = VALUE
        }
      } else if (s === NAME){
        if (this.beginComment.found(c)) // start comment
          this.name = this.getCache(v, i + 1), s = this.flushNode(), v = i + 1
        else if (c === 32 || c >= 9 && c <= 13) // ws
          this.name = this.getCache(v, i), s = NODE, v = i + 1
        else if (c === 47) // /
          this.flags.isSelfClose = true, this.name = this.getCache(v, i), s = NODE, v = i + 1
        else if (c === 62) // >
          this.name = this.getCache(v, i), s = this.flushNode(), v = i + 1
      } else if (s === KEY){
        if (c === 32 || c >= 9 && c <= 13) // ws
          this.key = this.getCache(v, i), s = NODE, v = i + 1
        else if (c === 61) // =
          this.flags.hasEqual = true, this.key = this.getCache(v, i), s = NODE, v = i + 1
        else if (c === 47) // /
          this.flags.isSelfClose = true, this.key = this.getCache(v, i), s = NODE, v = i + 1
        else if (c === 62) // >
          this.flushKey(v,i), s = this.flushNode(), v = i + 1
      } else if (s === VALUE){
        if (this.flags.valStartChar != null){
          if (c === this.flags.valStartChar) // found end quote
            this.flushVal(v,i), s = NODE, v = i + 1
        } else if (c === 32 || c >= 9 && c <= 13) // ws
          this.flushVal(v,i), s = NODE, v = i + 1
        else if (c === 62) // >
          this.flushVal(v,i), s = this.flushNode(), v = i + 1
      } else if (s === COMMENT && this.endComment.found(c))
        s = this.flushSpecialNode(v, i-2, "!--"), v = i + 1
      else if (s === SCRIPT && this.endScript.found(c))
        s = this.flushSpecialNode(v, i-8, "script"), v = i + 1
      else if (s === STYLE && this.endStyle.found(c))
        s = this.flushSpecialNode(v, i-7, "style"), v = i + 1
      i = i + 1
    }
    this.cache = this.cache.substr(v);
    this.curPos = i - v;
    this.minPos = 0;
    this.state = s;
  }
  reset() {
    this.endStyle.reset();
    this.endScript.reset();
    this.endComment.reset();
    this.beginComment.reset();

    this.state = TEXT;
    this.cache = "";
    this.name = "";
    this.key = "";
    this.text = [];
    this.data = {};

    this.curPos = 0;
    this.minPos = 0;

    this.flags = {
      isClose: null,
      isSelfClose: null,
      hasEqual: null,
      valStartChar: null,
    };
  }
  getCache(start, end) {
    return this.cache.substr(start, end-start);
  }
  addToCache(chunk) {
    return (this.cache += chunk).length;
  }
  flushKey(v, i) {
    return (this.key = this.data[this.key || this.cache.substr(v, i-v)] = "");
  }
  flushVal(v, i) {
    return (this.data[this.key] = this.cache.substr(v, i-v), this.key = "", this.flags.valStartChar = this.flags.hasEqual = null);
  }
  flushNode() {
    const name = this.name;
    if (!this.flags.isClose) this.push({name, data: this.data})
    if (this.flags.isSelfClose || this.flags.isClose) this.push({name})
    const s = name === "script" ? SCRIPT : name === "style" ? STYLE : name === "!--" ? COMMENT : TEXT
    this.data = {};
    this.name = "";
    this.flags.isClose = this.flags.isSelfClose = null
    return s
  }
  flushSpecialNode(v, i, name) {
    const text = this.cache.substr(v, i-v)
    text && this.push({text}), this.push({name})
    return TEXT
  }
  flushText(v, i) {
    if (v < i) {
      this.text.push(this.cache.substr(v, i-v))
      this.push({text: this.text.join(" ")})
      this.text = []
    } else if (this.text.length) {
      this.push({text: this.text.join(" ")})
      this.text = []
    }
  }
  flushAllText() {
    return this.flushText(this.minPos, this.curPos);
  }
}
