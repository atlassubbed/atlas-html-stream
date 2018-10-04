const HtmlParser = require("../src/HtmlParser");
const { createReadStream } = require("fs");
const { join } = require("path");
const { it } = require("mocha");
const assetRoot = join(__dirname, "assets")

module.exports = { parse, theyBoth, theyBothWithPreserveWSOption }

function theyBoth(should, name, test) {
  return theyBothWithPreserveWSOption(should, name, false, test)
}

// every test should also pass if chunks are super small
// - this simulates tokens which are split at chunk boundaries
//   e.g. parsing "chunk1 </sty", "le> chunk2" should capture a </style> tag.
function theyBothWithPreserveWSOption(should, name, preserveWS = true, test) {
  name = `${name}.html`;
  it(should, function(done){
    parse({name, preserveWS}, (err, res) => {
      err ? done(err) : test(res, done)
    })
  })
  it(`${should} across chunks`, function(done){
    parse({name, highWaterMark: 4, preserveWS}, (err, res) => {
      err ? done(err) : test(res, done)
    })
  })
}

// parse a file and return a list of results
function parse({name, highWaterMark, preserveWS}, cb) {
  const opts = highWaterMark ? {highWaterMark} : undefined;
  const file = createReadStream(join(assetRoot, name), opts);
  let calledCb = 0;
  file.on("error", err => {
    !calledCb++ && cb(err);
  });
  const results = [];
  file.pipe(new HtmlParser({preserveWS})).on("data", data => {
    results.push(data);
  }).on("end", () => {
    !calledCb++ && cb(null, results)
  })
}
