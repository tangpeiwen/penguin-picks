const assert = require("node:assert/strict");
const restaurants = require("../miniprogram/data/restaurants");
const {
  recommend,
  recommendAll,
  describeSelection,
  regionMatches,
  cuisineGroup,
  defaultPriceFilter,
  occasionFits,
  requiredPeople
} = require("../miniprogram/utils/recommend");
const { orderDishData } = require("../miniprogram/utils/order-card");
const { REGION_OPTIONS } = require("../miniprogram/config/regions");

assert.equal(restaurants.length, 166, "demo dataset should contain every reviewed visited and wishlist shop");
assert.equal(new Set(restaurants.map((item) => item.id)).size, restaurants.length, "restaurant IDs must be unique for list keys and map markers");
assert.ok(restaurants.every((item) => item.name && item.review && item.priceLabel));
assert.ok(restaurants.every((item) => Array.isArray(item.dishes) && item.dishes.length <= 7));
assert.equal(restaurants.filter((item) => item.dishes.length).length, 128);
assert.equal(restaurants.filter((item) => item.visited).length, 108);
assert.equal(restaurants.filter((item) => !item.visited).length, 58);
const forbiddenDishFallbacks = ["问店员：", "当日招牌", "时令菜", "现场推荐", "按食量再加"];
assert.ok(restaurants.every((item) => item.dishes.every((dish) =>
  forbiddenDishFallbacks.every((fallback) => dish.indexOf(fallback) === -1)
)), "dish data must not contain generated fallback advice");
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "pitfall")));
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "reservationDisplay")));
assert.equal(restaurants.filter((item) => item.reservationDisplay).length, 13);
assert.ok(restaurants.every((item) => item.reservationLabel), "every result card should have a concise queue label");
assert.ok(restaurants.some((item) => item.reservationLabel === "基本不用排队"));
assert.ok(restaurants.some((item) => item.reservationLabel === "可能要排队"));
assert.ok(restaurants.some((item) => item.reservationLabel === "建议提前订" || item.reservationLabel === "建议提前安排"));
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "latitude") && Object.prototype.hasOwnProperty.call(item, "longitude")));
assert.equal(restaurants.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).length, 165);
assert.ok(restaurants.filter((item) => Number.isFinite(item.latitude)).every((item) => item.latitude > 30 && item.latitude < 32.5));
assert.ok(restaurants.filter((item) => Number.isFinite(item.longitude)).every((item) => item.longitude > 120 && item.longitude < 123));
assert.ok(restaurants.every((item) => Object.prototype.hasOwnProperty.call(item, "building")));
assert.ok(restaurants.every((item) => Array.isArray(item.areas) && item.areas.length), "reviewed 片区 should be present on every restaurant");
assert.ok(restaurants.filter((item) => item.building).length >= 20, "building summaries should be extracted where available");
assert.ok(restaurants.every((item) => item.building.length <= 20));
assert.ok(restaurants.every((item) => ["中餐", "日料", "西餐", "火锅", "东南亚", "韩餐"].includes(cuisineGroup(item))));
const barbarian = restaurants.find((restaurant) => restaurant.name === "BARBARIAN餐厅");
assert.equal(cuisineGroup(barbarian), "西餐", "Latin American barbecue must not fall through to Chinese cuisine");
const french = restaurants.find((restaurant) => restaurant.cuisines.includes("法国菜"));
assert.equal(cuisineGroup(french), "西餐", "French cuisine must map to Western cuisine");
const mexican = restaurants.find((restaurant) => restaurant.cuisines.includes("墨西哥菜"));
assert.equal(cuisineGroup(mexican), "西餐", "Mexican cuisine must map to Western cuisine");
const indian = restaurants.find((restaurant) => restaurant.cuisines.includes("印度菜"));
assert.equal(cuisineGroup(indian), "东南亚", "Indian cuisine should follow the product's Southeast Asia filter decision");
assert.equal(restaurants.filter((item) => item.diet.includes("vegetarian")).length, 5, "vegetarian should require an explicit signal");
assert.deepEqual(defaultPriceFilter({ occasion: "casual" }), ["0-100", "100-200"]);
assert.deepEqual(defaultPriceFilter({ occasion: "guest" }), []);
assert.deepEqual(defaultPriceFilter({ occasion: "date" }), []);

const dishFixture = { dishes: ["一", "二", "三", "四", "五", "六", "七"] };
assert.equal(orderDishData(dishFixture).cardDishes.length, 7, "every CSV dish should be shown regardless of party size");
assert.equal(orderDishData(dishFixture).dishHeading, "点菜参考");
assert.equal(orderDishData({ ...dishFixture, visited: false }).dishHeading, "想点这些");
assert.equal(orderDishData({ dishes: ["一"] }).cardDishes.length, 1);
assert.equal(orderDishData({ dishes: [] }).dishHeading, "");

const occasions = ["date", "guest", "friends", "parents", "birthday", "talk", "solo", "casual", "explore"];
const peopleOptions = ["upto4", "5-6", "7-8", "9+"];
const regions = REGION_OPTIONS.map((item) => item.id);
assert.ok(restaurants.every((item) => item.areas.length === 1 && item.areas[0]), "every restaurant should have one primary card-display 片区");
assert.ok(restaurants.every((item) => regions.includes(item.district)), "every restaurant district should be a visible selection option");
assert.equal(requiredPeople("3-5"), 5, "legacy saved selections should remain readable");
assert.equal(requiredPeople("6+"), 6, "legacy saved selections should remain readable");

const allUnfiltered = recommendAll(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] }
);
assert.equal(allUnfiltered.length, restaurants.length, "map source should contain every current filter match without list pagination");
assert.equal(recommend(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] },
  0
).length, 3, "list source should remain capped at three restaurants");
const everyBatch = [];
for (let offset = 0; offset < Math.ceil(allUnfiltered.length / 3); offset += 1) {
  everyBatch.push(...recommend(
    { occasion: "explore", people: "", regions: ["不限区域"] },
    { cuisine: [], price: [], diet: [] },
    offset
  ));
}
assert.equal(everyBatch.length, restaurants.length);
assert.equal(new Set(everyBatch.map((item) => item.id)).size, everyBatch.length, "change batch must never repeat a previously displayed restaurant");
assert.equal(recommend(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] },
  Math.ceil(allUnfiltered.length / 3) - 1
).length, 1, "the last batch may contain only the final unseen restaurant");
assert.equal(recommend(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] },
  Math.ceil(allUnfiltered.length / 3)
).length, 0, "pagination should not wrap back to earlier restaurants");
const firstWishlist = allUnfiltered.findIndex((item) => !item.visited);
assert.equal(firstWishlist, 108, "regular ranking should place every visited restaurant before the wishlist");
assert.ok(allUnfiltered.slice(0, firstWishlist).every((item) => item.visited));
assert.ok(allUnfiltered.slice(firstWishlist).every((item) => !item.visited));

const wishlistOnly = recommendAll(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [], visitStatus: ["wishlist"] }
);
assert.equal(wishlistOnly.length, 58);
assert.ok(wishlistOnly.every((item) => !item.visited));

for (const occasion of occasions) {
  for (const people of peopleOptions) {
    for (const region of regions) {
      const selection = { occasion, people, regions: [region] };
      const rows = recommend(selection, { cuisine: "", price: "", diet: "" }, 0);
      assert.ok(rows.length <= 3, `${JSON.stringify(selection)} should return at most 3 honest matches`);
      assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, "results must be unique");
      assert.ok(rows.every((row) => row.maxPeople >= requiredPeople(people)), "capacity should fit");
      assert.ok(rows.every((row) => occasionFits(row, occasion)), "occasion must be a hard match");
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

const jingAn50 = restaurants.find((restaurant) => restaurant.name === "静安50");
assert.ok(jingAn50 && regionMatches(jingAn50, "静安区"));
assert.equal(jingAn50.areas[0], "静安寺", "result cards should retain the useful primary 片区");

const orientalHouse = restaurants.find((restaurant) => restaurant.id === "l1pFxEUMxhYPVMz7");
assert.equal(orientalHouse && orientalHouse.building, "嘉里中心", "generic 里 matching must not truncate 嘉里中心");

const bellaNapoli = restaurants.find((restaurant) => restaurant.name === "Bella Napoli");
assert.ok(bellaNapoli && regionMatches(bellaNapoli, "静安区"));
assert.equal(bellaNapoli.areas[0], "南京西路");

const multiRegionSelection = { occasion: "friends", people: "upto4", regions: ["静安区", "黄浦区"] };
assert.ok(describeSelection(multiRegionSelection).includes("静安区、黄浦区"));
assert.ok(!describeSelection(multiRegionSelection).includes("——"));

const pho = restaurants.find((restaurant) => restaurant.id === "G5bsxgt7wZHxPlhS");
assert.deepEqual(pho.occasions, ["solo", "casual"]);
assert.equal(occasionFits(pho, "date"), false);
assert.equal(occasionFits(pho, "solo"), true);

const guestOnly = restaurants.filter((restaurant) => restaurant.occasions.includes("guest") && !restaurant.occasions.includes("talk"));
const talkOnly = restaurants.filter((restaurant) => restaurant.occasions.includes("talk") && !restaurant.occasions.includes("guest"));
const dateOnly = restaurants.filter((restaurant) => restaurant.occasions.includes("date") && !restaurant.occasions.includes("talk"));
assert.equal(restaurants.filter((restaurant) => restaurant.occasions.includes("guest")).length, 58);
assert.equal(restaurants.filter((restaurant) => restaurant.occasions.includes("talk")).length, 39);
assert.ok(guestOnly.length > 0 && guestOnly.every((restaurant) => !occasionFits(restaurant, "talk")), "请客 should not imply 谈事");
assert.ok(talkOnly.length > 0 && talkOnly.every((restaurant) => !occasionFits(restaurant, "guest")), "谈事 should not imply 请客");
assert.ok(dateOnly.length > 0 && dateOnly.every((restaurant) => !occasionFits(restaurant, "talk")), "约会 should not imply 谈事");

const japanese = recommend(
  { occasion: "date", people: "2", regions: ["静安区"] },
  { cuisine: "日料", price: "", diet: "" },
  0
);
assert.ok(japanese.length >= 1);
assert.ok(japanese.every((row) => cuisineGroup(row) === "日料"));

for (const cuisine of ["中餐", "日料", "西餐", "火锅", "东南亚", "韩餐"]) {
  const rows = recommend(
    { occasion: "explore", people: "", regions: ["不限区域"] },
    { cuisine, price: "", diet: "" },
    0
  );
  assert.ok(rows.length >= 1, `${cuisine} should have at least one restaurant`);
  assert.ok(rows.every((row) => cuisineGroup(row) === cuisine));
}

const multipleCuisines = recommend(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: ["日料", "韩餐"], price: [], diet: [] },
  0
);
assert.ok(multipleCuisines.length >= 1);
assert.ok(multipleCuisines.every((row) => ["日料", "韩餐"].includes(cuisineGroup(row))));

const multipleDiets = recommend(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: ["no-spicy", "no-beef"] },
  0
);
assert.ok(multipleDiets.length >= 1);
assert.ok(multipleDiets.every((row) => row.diet.includes("no-spicy") && row.diet.includes("no-beef")));

const budget = recommend(
  { occasion: "friends", people: "upto4", regions: ["浦东新区"] },
  { cuisine: "", price: ["0-100", "100-200"], diet: "" },
  0
);
assert.ok(budget.length >= 1);
assert.ok(budget.every((row) => row.priceMin < 200));

[
  ["0-100", (row) => row.priceMax <= 100],
  ["100-200", (row) => row.priceMax <= 200],
  ["200-300", (row) => row.priceMax <= 300],
  ["300-500", (row) => row.priceMax <= 500],
  ["500-700", (row) => row.priceMax <= 700],
  ["700-9999", (row) => row.priceMin >= 700]
].forEach(([price, matches]) => {
  const priced = recommend(
    { occasion: "explore", people: "", regions: ["不限区域"] },
    { cuisine: [], price: [price], diet: [] },
    0
  );
  assert.ok(priced.length >= 1, `${price} should have at least one restaurant`);
  assert.ok(priced.every(matches), `${price} should follow the cumulative budget rule`);
});

const underTwoHundred = recommendAll(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: ["100-200"], diet: [] }
);
const underThreeHundred = recommendAll(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: [], price: ["200-300"], diet: [] }
);
assert.ok(underTwoHundred.every((row) => underThreeHundred.some((candidate) => candidate.id === row.id)), "a higher budget cap should include every lower-priced match");

const noBeef = recommend(
  { occasion: "explore", people: "", regions: ["不限区域"] },
  { cuisine: "", price: "", diet: "no-beef" },
  0
);
assert.ok(noBeef.length >= 1);
assert.ok(noBeef.every((row) => row.diet.includes("no-beef")));

const ordinaryOccasion = recommend(
  { occasion: "date", people: "2", regions: ["不限区域"] },
  { cuisine: "", price: "", diet: "" },
  0
);
assert.ok(ordinaryOccasion.every((row) => row.priceMin < 300), "ordinary occasions should show the under-300 group first");

const bund = recommend(
  { occasion: "date", people: "2", regions: ["黄浦区"] },
  { cuisine: "", price: "", diet: "" },
  0
);
const bundPrices = bund.map((row) => row.priceMin);
const firstHigherPrice = bundPrices.findIndex((price) => price >= 300);
if (firstHigherPrice !== -1) {
  assert.ok(bundPrices.slice(0, firstHigherPrice).every((price) => price < 300), "under-300 results should come first");
  assert.deepEqual(
    bundPrices.slice(firstHigherPrice),
    [...bundPrices.slice(firstHigherPrice)].sort((a, b) => a - b),
    "higher-price results should then be ascending"
  );
}

const fitsFour = recommendAll(
  { occasion: "explore", people: "upto4", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] }
);
const fitsFive = recommendAll(
  { occasion: "explore", people: "5-6", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] }
);
assert.ok(fitsFour.some((row) => row.maxPeople === 4), "four people should include restaurants capped at four");
assert.ok(fitsFour.every((row) => row.maxPeople >= 4));
assert.ok(fitsFive.every((row) => row.maxPeople >= 5), "five people should exclude restaurants capped at four");
assert.ok(!fitsFive.some((row) => row.maxPeople === 4));

const fitsSeven = recommendAll(
  { occasion: "explore", people: "7-8", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] }
);
const fitsNine = recommendAll(
  { occasion: "explore", people: "9+", regions: ["不限区域"] },
  { cuisine: [], price: [], diet: [] }
);
assert.ok(fitsSeven.some((row) => row.maxPeople === 8));
assert.ok(fitsSeven.every((row) => row.maxPeople >= 7));
assert.ok(fitsNine.some((row) => row.maxPeople === 10));
assert.ok(fitsNine.every((row) => row.maxPeople >= 9));

console.log(`Recommendation checks passed for ${occasions.length * peopleOptions.length * regions.length} core combinations, four capacity groups, multi-region selection, and representative filters.`);
