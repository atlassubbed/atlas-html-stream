const HtmlParser = require("../src/HtmlParser");
const { createReadStream } = require("fs");
const { join } = require("path");
const { it } = require("mocha");
const assetRoot = join(__dirname, "assets")

// parse a file and return a list of results
const parse = ({name, highWaterMark}, cb) => {
  const opts = highWaterMark ? {highWaterMark} : undefined;
  const file = createReadStream(join(assetRoot, name), opts);
  let calledCb = 0;
  file.on("error", err => {
    !calledCb++ && cb(err);
  });
  const results = [];
  file.pipe(new HtmlParser()).on("data", data => {
    results.push(data);
  }).on("end", () => {
    !calledCb++ && cb(null, results)
  })
}

// every test should also pass if chunks are super small
// - this simulates tokens which are split at chunk boundaries
//   e.g. parsing "chunk1 </sty", "le> chunk2" should capture a </style> tag.
const theyBoth = (should, name, test) => {
  name = `${name}.html`;
  it(should, function(done){
    parse({name}, (err, res) => {
      err ? done(err) : test(res, done)
    })
  })
  it(`${should} across chunks`, function(done){
    parse({name, highWaterMark: 4}, (err, res) => {
      err ? done(err) : test(res, done)
    })
  })
}

module.exports = { parse, theyBoth }