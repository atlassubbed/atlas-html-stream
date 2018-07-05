const SeqMatcher = require("atlas-seq-matcher");
const { Transform } = require("stream");
const { TEXT, NODE, NAME, KEY, VALUE, SCRIPT, STYLE, COMMENT } = require("./states");

module.exports = class HtmlParser extends Transform {
  constructor(){
    super({readableObjectMode: true})
    const endScript = SeqMatcher("</script>")
    const endStyle = SeqMatcher("</style>")
    const beginComment = SeqMatcher("!--")
    const endComment = SeqMatcher("-->")
    let cache, name, key, text, data, state, curPos, minPos;
    let isClose, isSelfClose, hasEqual, valStartChar;
    this.reset = () => {
      endStyle.reset(), endScript.reset();
      state = TEXT, data = {}, text = [], name = cache = key = "";
      curPos = minPos = 0;
      isClose = isSelfClose = hasEqual = valStartChar = null;
    }
    this.reset();
    this.cache = chunk => (cache+=chunk).length;
    const getCache = (start, end) => cache.substr(start, end-start);
    const clearCache = () => (cache = cache.substr(minPos), curPos -= minPos, minPos = 0);
    const flushKey = (v, i) => (key = data[key || cache.substr(v, i-v)] = "")
    const flushVal = (v, i) => (data[key] = cache.substr(v, i-v), key = "", valStartChar = hasEqual = null)
    const flushNode = () => {
      if (!isClose) this.push({name, data})
      if (isSelfClose || isClose) this.push({name})
      const s = name === "script" ? SCRIPT : name === "style" ? STYLE : name === "!--" ? COMMENT : TEXT
      data = {}, name = "", isClose = isSelfClose = null
      return s
    }
    const flushSpecialNode = (v, i, name) => {
      const text = cache.substr(v, i-v)
      text && this.push({text}), this.push({name})
    }
    const flushText = (v, i) => {
      if (v < i) {
        text.push(cache.substr(v, i-v))
        this.push({text:text.join(" ")})
        text = []
      } else if (text.length) {
        this.push({text:text.join(" ")})
        text = []
      }
    }
    this.flushText = () => flushText(minPos, curPos)
    this.parse = cacheLen => {
      let i = curPos, v = minPos, s = state, c
      while (i < cacheLen){
        c = cache.charCodeAt(i)
        if (s === TEXT){
          // in text
          if (c === 32 || c >= 9 && c <= 13) {
            // found whitespace
            v < i && text.push(getCache(v, i)), v = i + 1
          } else if (c === 60) {
            // found open tag <
            flushText(v, i), s = NODE, v = i + 1
          }
        } else if (s === NODE){
          // in a node
          if (c === 62) {
            // found closing tag >
            key && flushKey(), s = flushNode(), v = i + 1
          } else if (c === 47) {
            // found /
            isClose = !(isSelfClose = !!name)
          } else if (c !== 32 && (c < 9 || c > 13)){
            // found non-whitespace
            if (!name) {
              // found name start
              beginComment.found(c)
              v = i, s = NAME
            } else if (!key) {
              // found key start
              v = i, s = KEY
            } else if (c === 61) {
              // found = after key
              hasEqual = true
            } else if (!hasEqual) {
              // found start of next key
              flushKey(), v = i, s = KEY
            } else if (c === 34 || c === 39) {
              // found start of quoted value
              v = i + 1, valStartChar = c, s = VALUE
            } else {
              // found start of un-quoted value
              v = i, s = VALUE
            }
          }
        } else if (s === NAME){
          // in node's name
          if (beginComment.found(c)){
            // found comment, ends node
            name = getCache(v, i + 1), s = flushNode(), v = i + 1
          } else if (c === 32 || c >= 9 && c <= 13) {
            // found whitespace, ends name
            name = getCache(v, i), s = NODE, v = i + 1
          } else if (c === 47) {
            // found /
            isSelfClose = true, name = getCache(v, i), s = NODE, v = i + 1
          } else if (c === 62){
            // found >, ends node
            name = getCache(v, i), s = flushNode(), v = i + 1
          }
        } else if (s === KEY){
          // in node's key
          if (c === 32 || c >= 9 && c <= 13) {
            // found whitespace, ends key
            key = getCache(v, i), s = NODE, v = i + 1
          } else if (c === 61) {
            // found =, ends key
            hasEqual = true, key = getCache(v, i), s = NODE, v = i + 1
          } else if (c === 47) {
            // found /
            isSelfClose = true, key = getCache(v, i), s = NODE, v = i + 1
          } else if (c === 62) {
            // found >, ends node
            flushKey(v,i), s = flushNode(), v = i + 1
          }
        } else if (s === VALUE){
          // in node's current key's value
          if (valStartChar != null){
            // is a quoted value
            if (c === valStartChar) {
              // found end of quoted value
              flushVal(v,i), s = NODE, v = i + 1
            }
          } else if (c === 32 || c >= 9 && c <= 13) {
            // found whitespace, ends un-quoted value
            flushVal(v,i), s = NODE, v = i + 1
          } else if (c === 62) {
            // found >, ends value and node
            flushVal(v,i), s = flushNode(), v = i + 1
          } else if (c === 47) {
            // found /
            isSelfClose = true, flushVal(v,i), s = NODE, v = i + 1
          }
        } else if (s === COMMENT && endComment.found(c)){
          // found end of comment node
          flushSpecialNode(v, i-2, "!--"), s = TEXT, v = i + 1
        } else if (s === SCRIPT && endScript.found(c)){
          // found end of script node
          flushSpecialNode(v, i-8, "script"), s = TEXT, v = i + 1
        } else if (s === STYLE && endStyle.found(c)){
          // found end of style node
          flushSpecialNode(v, i-7, "style"), s = TEXT, v = i + 1
        }
        i = i + 1
      }
      curPos = i, minPos = v, state = s, clearCache()
    }
  }
  _transform(chunk, encoding, done){
    if (chunk === null) return this.end();
    this.parse(this.cache(chunk));
    done(null)
  }
  _flush(done){
    this.flushText();
    this.reset();
    done(null)
  }
}
