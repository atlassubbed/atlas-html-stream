const SeqMatcher = require("atlas-seq-matcher");
const { Transform } = require("stream");
const { TEXT, NODE, NAME, KEY, VALUE, SCRIPT, STYLE, COMMENT } = require("./states");

module.exports = class HtmlParser extends Transform {
  constructor({preserveNbsp} = {preserveNbsp: false}){
    super({readableObjectMode: true})
    const endScript = SeqMatcher("</script>")
    const endStyle = SeqMatcher("</style>")
    const beginComment = SeqMatcher("!--")
    const endComment = SeqMatcher("-->")
    let cache, name, key, text, data, state, curPos, minPos;
    let isClose, isSelfClose, hasEqual, valStartChar;
    this.reset = () => {
      endStyle.reset(), endScript.reset(), endComment.reset(), beginComment.reset();
      state = TEXT, data = {}, text = [], name = cache = key = "";
      curPos = minPos = 0;
      isClose = isSelfClose = hasEqual = valStartChar = null;
    }
    this.reset();
    this.cache = chunk => (cache+=chunk).length;
    const getCache = (start, end) => cache.substr(start, end-start);
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
      return TEXT
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
          if ( c === 32 && !preserveNbsp)
            v < i && text.push(getCache(v, i)), v = i + 1
          else if (c >= 9 && c <= 13) // ws
            v < i && text.push(getCache(v, i)), v = i + 1
          else if (c === 60) // <
            flushText(v, i), s = NODE, v = i + 1
        } else if (s === NODE){
          if (c === 62) // >
            key && flushKey(), s = flushNode(), v = i + 1
          else if (c === 47) // /
            isClose = !(isSelfClose = !!name)
          else if (c !== 32 && (c < 9 || c > 13)){ // !ws
            if (!name) // name start
              beginComment.found(c), v = i, s = NAME
            else if (!key) // key start
              v = i, s = KEY
            else if (c === 61) // =
              hasEqual = true
            else if (!hasEqual) // next key
              flushKey(), v = i, s = KEY
            else if (c === 34 || c === 39) // ', "
              v = i + 1, valStartChar = c, s = VALUE
            else // un-quoted val
              v = i, s = VALUE
          }
        } else if (s === NAME){
          if (beginComment.found(c)) // start comment
            name = getCache(v, i + 1), s = flushNode(), v = i + 1
          else if (c === 32 || c >= 9 && c <= 13) // ws
            name = getCache(v, i), s = NODE, v = i + 1
          else if (c === 47) // /
            isSelfClose = true, name = getCache(v, i), s = NODE, v = i + 1
          else if (c === 62) // >
            name = getCache(v, i), s = flushNode(), v = i + 1
        } else if (s === KEY){
          if (c === 32 || c >= 9 && c <= 13) // ws
            key = getCache(v, i), s = NODE, v = i + 1
          else if (c === 61) // =
            hasEqual = true, key = getCache(v, i), s = NODE, v = i + 1
          else if (c === 47) // /
            isSelfClose = true, key = getCache(v, i), s = NODE, v = i + 1
          else if (c === 62) // >
            flushKey(v,i), s = flushNode(), v = i + 1
        } else if (s === VALUE){
          if (valStartChar != null){
            if (c === valStartChar) // found end quote
              flushVal(v,i), s = NODE, v = i + 1
          } else if (c === 32 || c >= 9 && c <= 13) // ws
            flushVal(v,i), s = NODE, v = i + 1
          else if (c === 62) // >
            flushVal(v,i), s = flushNode(), v = i + 1
          else if (c === 47) // /
            isSelfClose = true, flushVal(v,i), s = NODE, v = i + 1
        } else if (s === COMMENT && endComment.found(c))
          s = flushSpecialNode(v, i-2, "!--"), v = i + 1
        else if (s === SCRIPT && endScript.found(c))
          s = flushSpecialNode(v, i-8, "script"), v = i + 1
        else if (s === STYLE && endStyle.found(c))
          s = flushSpecialNode(v, i-7, "style"), v = i + 1
        i = i + 1
      }
      cache = cache.substr(v), curPos = i - v, minPos = 0, state = s;
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
