const assert = require("node:assert/strict");

let pageDefinition;
let openedLocations = 0;

global.Page = (definition) => { pageDefinition = definition; };
global.wx = {
  openLocation() { openedLocations += 1; },
  showToast() {}
};

require("../miniprogram/pages/results/results");

const restaurant = {
  id: "interaction-fixture",
  name: "交互测试餐厅",
  address: "上海市测试路1号",
  latitude: 31.2,
  longitude: 121.4
};

const page = {
  ...pageDefinition,
  data: {
    ...pageDefinition.data,
    results: [restaurant],
    orderCard: null
  },
  setData(patch) { Object.assign(this.data, patch); }
};

page.openLocation({ currentTarget: { dataset: { id: restaurant.id } } });
assert.equal(openedLocations, 1, "location icon button should open the native map");
assert.equal(page.data.orderCard, null, "location tap should not also open the order card");

page.openOrderCard({ currentTarget: { dataset: { id: restaurant.id } } });
assert.equal(page.data.orderCard.id, restaurant.id, "card should still open after returning from the native map");

const wxml = require("node:fs").readFileSync(
  require("node:path").join(__dirname, "../miniprogram/pages/results/results.wxml"),
  "utf8"
);
assert.match(wxml, /class="navigate-button"[\s\S]*?catchtap="openLocation"/, "only the location button should own map navigation");
assert.doesNotMatch(wxml, /class="location-row"[^>]*(?:catchtap|bindtap|mark:action)/, "location text and row must remain part of the order-card tap target");

console.log("Results interaction check passed: map navigation does not block the next order-card tap.");
