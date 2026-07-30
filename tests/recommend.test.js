const assert = require("node:assert/strict");
const restaurants = require("../miniprogram/data/restaurants");
const { recommend, describeSelection, regionMatches } = require("../miniprogram/utils/recommend");
const { REGION_OPTIONS } = require("../miniprogram/config/regions");

assert.equal(restaurants.length, 93, "demo dataset should contain the current reviewed rows");
assert.ok(restaurants.every((item) => item.name && item.review && item.priceLabel));

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
