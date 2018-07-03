const SeqMatcher = require("atlas-seq-matcher");
const { Transform } = require("stream");
const { TEXT, NODE, NAME, KEY, VALUE, SCRIPT, STYLE } = require("./states");

module.exports = class HtmlParser extends Transform {
  constructor(){
    super({readableObjectMode: true})
  }
  _transform(chunk, encoding, done){
    done(null)
  }
  _flush(done){
    done(null)
  }
}