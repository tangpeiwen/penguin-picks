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
  setData(patch, done) { Object.assign(this.data, patch); if (done) done(); }
};

page.openLocation({ currentTarget: { dataset: { id: restaurant.id } } });
assert.equal(openedLocations, 1, "location icon button should open the native map");
assert.equal(page.data.orderCard, null, "location tap should not also open the order card");

page.openOrderCard({ currentTarget: { dataset: { id: restaurant.id } } });
assert.equal(page.data.orderCard.id, restaurant.id, "card should still open after returning from the native map");

let refreshes = 0;
page.refresh = () => { refreshes += 1; };
page.data.offset = 2;
page.previousBatch();
assert.equal(page.data.offset, 1, "previous batch should move back exactly one page");
assert.equal(refreshes, 1, "previous batch should refresh the visible restaurants");

const wxml = require("node:fs").readFileSync(
  require("node:path").join(__dirname, "../miniprogram/pages/results/results.wxml"),
  "utf8"
);
const wxss = require("node:fs").readFileSync(
  require("node:path").join(__dirname, "../miniprogram/pages/results/results.wxss"),
  "utf8"
);
const listMarkup = wxml.slice(wxml.indexOf('class="result-list'), wxml.indexOf('class="map-view'));
assert.doesNotMatch(listMarkup, /点菜卡/, "the result list should not repeat the detail-card label");
assert.match(listMarkup, /class="navigate-button"[\s\S]*?catchtap="openLocation"/, "the area metadata should retain direct icon navigation");
assert.match(listMarkup, /location-pin-red\.png/, "list navigation should use the existing location icon");
assert.match(wxml, /class="order-map-button"[\s\S]*?catchtap="openLocation"/, "map navigation should remain available beside the detail address");
assert.match(listMarkup, /class="cuisine hand-title"/, "cuisine should remain the card's single blue visual tag");
assert.match(listMarkup, /priceDisplay\}\} · \{\{item\.locationSummary/, "price and location should share one quiet metadata line");
assert.doesNotMatch(require("node:fs").readFileSync(require("node:path").join(__dirname, "../miniprogram/pages/results/results.js"), "utf8"), /return `\$\{region\} · \$\{building\}`/, "list location summaries should not append mall names");
assert.match(listMarkup, /wx:if="\{\{!item\.visited\}\}" class="wishlist-badge/, "only wishlist restaurants should show a status badge");
assert.match(listMarkup, /class="detail-chevron"[^>]*>›<\/text>/, "every result card should expose a quiet drill-in affordance");
assert.match(listMarkup, /fallbackNameFont \? 'fallback-name-font'/, "names containing unsupported traditional glyphs should use one consistent fallback font");
assert.match(wxss, /\.restaurant-name\.fallback-name-font \{[^}]*font-size: 40rpx;/, "fallback list names should be smaller than handwritten names");
assert.match(wxss, /\.order-name\.fallback-name-font \{[^}]*font-size: 37rpx;/, "fallback detail names should be smaller than handwritten names");
assert.doesNotMatch(listMarkup, /吃过|visit-badge/, "visited restaurants should use the unmarked default state");
assert.match(listMarkup, /wx:if="\{\{item\.queueException\}\}" class="queue-exception"/, "only queue exceptions should add a final line");
assert.match(wxml, />我吃过的<\/button>[\s\S]*?>待吃清单<\/button>/, "explore mode should expose separate visited and wishlist tabs");
assert.match(wxml, /orderCard\.reviewHeading/, "visited and wishlist detail cards should use different review headings");
assert.match(wxml, /hasPrevious \|\| hasMore[\s\S]*?bindtap="previousBatch"[\s\S]*?上一批[\s\S]*?bindtap="changeBatch"[\s\S]*?下一批/, "list pagination should support both previous and next batches");
assert.match(wxss, /\.order-action \{[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: center;[^}]*font-size: 34rpx;/, "save-image text should be enlarged and centered with flex layout");

console.log("Results interaction check passed: map navigation does not block the next order-card tap.");
