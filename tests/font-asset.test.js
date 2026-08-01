const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const styles = path.join(__dirname, "../miniprogram/styles");
const maxBytes = 200 * 1024;
const shards = ["font-static.wxss", "font-restaurants.wxss"];

for (const shard of shards) {
  const file = path.join(styles, shard);
  assert.ok(fs.existsSync(file), `${shard} should be generated`);
  assert.ok(fs.statSync(file).size < maxBytes, `${shard} must stay below 200 KiB`);
  assert.match(fs.readFileSync(file, "utf8"), /data:font\/woff2;base64,/, `${shard} should embed WOFF2`);
}

const index = fs.readFileSync(path.join(styles, "fonts.wxss"), "utf8");
assert.match(index, /font-static\.wxss/);
assert.match(index, /font-restaurants\.wxss/);

console.log("Font asset check passed: both embedded WOFF2 shards stay below 200 KiB.");
