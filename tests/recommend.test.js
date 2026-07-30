const assert = require("node:assert/strict");
const restaurants = require("../miniprogram/data/restaurants");
const { recommend, describeSelection, regionMatches } = require("../miniprogram/utils/recommend");
const { dishCountForPeople, orderDishData } = require("../miniprogram/utils/order-card");
const { REGION_OPTIONS } = require("../miniprogram/config/regions");

assert.equal(restaurants.length, 87, "demo dataset should contain the reviewed rows from the latest geocoded source");
assert.ok(restaurants.every((item) => item.name && item.review && item.priceLabel));
assert.ok(restaurants.every((item) => Array.isArray(item.dishes) && item.dishes.length <= 7));
assert.equal(restaurants.filter((item) => item.dishes.length).length, 69);
const forbiddenDishFallbacks = ["问店员：", "当日招牌", "时令菜", "现场推荐", "按食量再加"];
assert.ok(restaurants.every((item) => item.dishes.every((dish) =>
  forbiddenDishFallbacks.every((fallback) => dish.indexOf(fallback) === -1)
)), "dish data must not contain generated fallback advice");
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "pitfall")));
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "reservationDisplay")));
assert.equal(restaurants.filter((item) => item.reservationDisplay).length, 9);
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "latitude") && Object.prototype.hasOwnProperty.call(item, "longitude")));
assert.ok(restaurants.every((item) => Number.isFinite(item.latitude) && item.latitude > 30 && item.latitude < 32.5));
assert.ok(restaurants.every((item) => Number.isFinite(item.longitude) && item.longitude > 120 && item.longitude < 123));
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "building")));
assert.ok(restaurants.filter((item) => item.building).length >= 20, "building summaries should be extracted where available");
assert.ok(restaurants.every((item) => item.building.length <= 20));

assert.deepEqual(
  ["1", "2", "3-5", "6+"].map(dishCountForPeople),
  [3, 4, 6, 7],
  "dish count should follow the selected party size"
);
const dishFixture = { dishes: ["一", "二", "三", "四", "五", "六", "七"] };
assert.equal(orderDishData(dishFixture, "3-5").cardDishes.length, 6);
assert.equal(orderDishData(dishFixture, "3-5").dishHeading, "点菜参考");
assert.equal(orderDishData({ dishes: ["一"] }, "6+").cardDishes.length, 1);
assert.equal(orderDishData({ dishes: [] }, "2").dishHeading, "");

const occasions = ["date", "guest", "friends", "parents", "birthday", "talk", "solo", "casual", "explore"];
const peopleOptions = ["1", "2", "3-5", "6+"];
const regions = REGION_OPTIONS.map((item) => item.id);
const requiredPeople = { "1": 1, "2": 2, "3-5": 5, "6+": 6 };

for (const occasion of occasions) {
  for (const people of peopleOptions) {
    for (const region of regions) {
      const selection = { occasion, people, regions: [region] };
      const rows = recommend(selection, { cuisine: "", price: "", diet: "" }, 0);
      assert.ok(rows.length >= 1 && rows.length <= 4, `${JSON.stringify(selection)} should return 1–4 honest matches`);
      assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, "results must be unique");
      assert.ok(rows.every((row) => row.maxPeople >= requiredPeople[people]), "capacity should fit");
      if (region !== "不限区域") {
        assert.ok(rows.every((row) => regionMatches(row, region)), "results should stay inside selected regions");
      }
      const expectedRegion = region === "不限区域" ? "全上海" : region;
      if (occasion !== "explore") assert.ok(describeSelection(selection).includes(expectedRegion));
    }
  }
}

for (const region of regions.filter((item) => item !== "不限区域")) {
  const covered = restaurants.filter((restaurant) => regionMatches(restaurant, region));
  assert.ok(covered.length >= 1, `${region} should cover at least one restaurant`);
}

assert.ok(restaurants.every((restaurant) => regions
  .filter((item) => item !== "不限区域")
  .some((region) => regionMatches(restaurant, region))), "every restaurant should belong to at least one visible region");

const multiRegionSelection = { occasion: "friends", people: "3-5", regions: ["静安寺", "南京西路"] };
assert.ok(describeSelection(multiRegionSelection).includes("静安寺、南京西路"));

const japanese = recommend(
  { occasion: "date", people: "2", regions: ["静安寺"] },
  { cuisine: "日料", price: "", diet: "" },
  0
);
assert.ok(japanese.length >= 1);
assert.ok(japanese.every((row) => row.cuisines.includes("日料")));

const budget = recommend(
  { occasion: "friends", people: "3-5", regions: ["前滩"] },
  { cuisine: "", price: "0-200", diet: "" },
  0
);
assert.ok(budget.length >= 1);
assert.ok(budget.every((row) => row.priceMin < 200));

console.log("Recommendation checks passed for 576 core combinations, multi-region selection, and representative filters.");
