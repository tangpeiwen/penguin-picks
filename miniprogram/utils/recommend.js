const restaurants = require("../data/restaurants");
const { REGION_OPTIONS } = require("../config/regions");

const OCCASION_LABELS = {
  date: "约会",
  guest: "请客",
  friends: "朋友聚会",
  birthday: "过生日",
  casual: "随便吃吃",
  explore: "看看我都吃了什么",
  solo: "一人食",
  parents: "带爸妈",
  talk: "安静谈事",
  browse: "找点灵感"
};

const PEOPLE_LABELS = {
  "1": "1个人",
  "2": "2个人",
  upto4: "4人以内",
  "5-6": "5–6人",
  "7-8": "7–8人",
  "9+": "9人以上"
};
const PEOPLE_REQUIRED = { upto4: 4, "5-6": 5, "7-8": 7, "9+": 9, "3-5": 5, "6+": 6 };

const CUISINE_GROUP_MATCHERS = [
  { id: "韩餐", terms: ["韩餐", "韩式"] },
  { id: "日料", terms: ["日料", "日式", "寿司", "烧鸟"] },
  { id: "东南亚", terms: ["东南亚", "泰国", "越南"] },
  { id: "西餐", terms: ["西餐", "西班牙", "意大利"] },
  { id: "火锅", terms: ["火锅"] }
];

function cuisineGroup(restaurant) {
  const cuisines = restaurant.cuisines || [];
  const matched = CUISINE_GROUP_MATCHERS.find((group) =>
    cuisines.some((cuisine) => group.terms.some((term) => cuisine.indexOf(term) !== -1))
  );
  return matched ? matched.id : "中餐";
}

function defaultPriceFilter(selection) {
  return selection.occasion === "casual" ? ["0-100", "100-200"] : [];
}

function regionMatches(restaurant, region) {
  if (!region || region === "不限区域") return true;
  if (Array.isArray(restaurant.areas) && restaurant.areas.length) {
    return restaurant.areas.indexOf(region) !== -1;
  }
  const haystack = `${restaurant.district} ${restaurant.region} ${restaurant.address}`;
  const standardGroups = REGION_OPTIONS.filter((item) => item.terms.length);
  if (region === "其他区域") {
    return !standardGroups.some((group) => group.terms.some((term) => haystack.indexOf(term) !== -1));
  }
  const group = REGION_OPTIONS.find((item) => item.id === region);
  return group ? group.terms.some((term) => haystack.indexOf(term) !== -1) : false;
}

function selectedRegions(selection) {
  if (Array.isArray(selection.regions) && selection.regions.length) return selection.regions;
  return selection.region ? [selection.region] : [];
}

function requiredPeople(people) {
  if (PEOPLE_REQUIRED[people]) return PEOPLE_REQUIRED[people];
  const count = Number(people);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function peopleFits(restaurant, people) {
  return !people || restaurant.maxPeople >= requiredPeople(people);
}

function occasionFits(restaurant, occasion) {
  if (!occasion || occasion === "browse" || occasion === "explore") return true;
  return restaurant.occasions.indexOf(occasion) !== -1;
}

function filterValues(filters, key) {
  const value = filters[key];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function priceMatches(restaurant, value) {
  const parts = value.split("-").map(Number);
  return restaurant.priceMin < (parts[1] || 9999) && restaurant.priceMax > parts[0];
}

function scoreRestaurant(restaurant, selection, filters) {
  let score = restaurant.star * 1.2 + Math.min(restaurant.fullReview.length / 100, 2.5);
  if (selection.occasion && selection.occasion !== "browse" && selection.occasion !== "explore") {
    score += occasionFits(restaurant, selection.occasion) ? 12 : -3;
  }
  const regions = selectedRegions(selection).filter((item) => item !== "不限区域");
  if (regions.length) {
    score += regions.some((region) => regionMatches(restaurant, region)) ? 14 : -8;
  }
  if (selection.people) score += peopleFits(restaurant, selection.people) ? 6 : -20;
  const cuisines = filterValues(filters, "cuisine");
  const prices = filterValues(filters, "price");
  const diets = filterValues(filters, "diet");
  if (cuisines.length) score += cuisines.indexOf(cuisineGroup(restaurant)) !== -1 ? 10 : -18;
  if (prices.length) score += prices.some((price) => priceMatches(restaurant, price)) ? 9 : -18;
  if (diets.length) score += diets.every((diet) => restaurant.diet.indexOf(diet) !== -1) ? 8 : -24;
  if (restaurant.reservationLevel === "easy") score += 1;
  return score;
}

function recommendAll(selection, filters) {
  const activeRegions = selectedRegions(selection).filter((item) => item !== "不限区域");
  const cuisines = filterValues(filters, "cuisine");
  const prices = filterValues(filters, "price");
  const diets = filterValues(filters, "diet");
  return restaurants
    .filter((restaurant) => !activeRegions.length || activeRegions.some((region) => regionMatches(restaurant, region)))
    .filter((restaurant) => peopleFits(restaurant, selection.people))
    .filter((restaurant) => occasionFits(restaurant, selection.occasion))
    .filter((restaurant) => !cuisines.length || cuisines.indexOf(cuisineGroup(restaurant)) !== -1)
    .filter((restaurant) => !diets.length || diets.every((diet) => restaurant.diet.indexOf(diet) !== -1))
    .filter((restaurant) => !prices.length || prices.some((price) => priceMatches(restaurant, price)))
    .map((restaurant) => ({ ...restaurant, score: scoreRestaurant(restaurant, selection, filters) }))
    .sort((a, b) => {
      if (!["casual", "guest"].includes(selection.occasion) && !prices.length) {
        const aAffordable = a.priceMin < 300;
        const bAffordable = b.priceMin < 300;
        if (aAffordable !== bAffordable) return aAffordable ? -1 : 1;
        if (!aAffordable && a.priceMin !== b.priceMin) return a.priceMin - b.priceMin;
      }
      return b.score - a.score || b.star - a.star;
    });
}

function recommend(selection, filters, offset) {
  const ranked = recommendAll(selection, filters);
  const count = Math.min(3, ranked.length);
  const start = ranked.length ? (offset * count) % ranked.length : 0;
  return ranked.slice(start, start + count).concat(
    start + count > ranked.length ? ranked.slice(0, start + count - ranked.length) : []
  );
}

function describeSelectionParts(selection) {
  if (selection.occasion === "browse" || selection.occasion === "explore") {
    return {
      occasion: "看看我都吃了什么",
      details: "不限人数 · 不限区域",
      judgment: "不设目的地，帮你发现一些值得去试试的地方。"
    };
  }
  const occasion = OCCASION_LABELS[selection.occasion] || "这顿饭";
  const people = PEOPLE_LABELS[selection.people] || "人数不限";
  const regions = selectedRegions(selection);
  let region = "全上海";
  if (regions.length && regions.indexOf("不限区域") === -1) {
    region = regions.length <= 2 ? regions.join("、") : `${regions.slice(0, 2).join("、")}等${regions.length}个片区`;
  }
  const judgments = {
    date: "在舒服的氛围里慢慢吃慢慢聊。",
    guest: "不管关系远近都不会失礼。",
    friends: "相聚本身就是快乐的一部分。",
    solo: "一个人也值得好好吃的一顿饭。",
    birthday: "多一点特别，多一点仪式感。",
    casual: "环境普普，但味道对得起这个价。",
    parents: "一家人都能自在吃顿饭。",
    talk: "在安静、克制有分寸的地方聊重要的事。",
    explore: "不设目的地，帮你发现一些值得去试试的地方。"
  };
  return {
    occasion,
    details: `${people} · ${region}`,
    judgment: judgments[selection.occasion] || "这几家比较合适。"
  };
}

function describeSelection(selection) {
  const parts = describeSelectionParts(selection);
  return `${parts.occasion} ${parts.details} ${parts.judgment}`;
}

module.exports = {
  recommend,
  recommendAll,
  describeSelection,
  describeSelectionParts,
  regionMatches,
  selectedRegions,
  cuisineGroup,
  defaultPriceFilter,
  occasionFits,
  OCCASION_LABELS,
  PEOPLE_LABELS,
  requiredPeople
};
