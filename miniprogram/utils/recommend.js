const restaurants = require("../data/restaurants");
const { REGION_OPTIONS } = require("../config/regions");

const OCCASION_LABELS = {
  date: "约会",
  guest: "招待客人",
  friends: "朋友聚会",
  birthday: "过生日",
  casual: "随便吃吃",
  explore: "看看我都吃了什么",
  solo: "一人食",
  parents: "带爸妈",
  talk: "安静谈事",
  browse: "找点灵感"
};

const PEOPLE_LABELS = { "1": "一个人", "2": "两个人", "3-5": "三到五个人", "6+": "六个人以上" };
const PEOPLE_REQUIRED = { "1": 1, "2": 2, "3-5": 5, "6+": 6 };

function regionMatches(restaurant, region) {
  if (!region || region === "不限区域") return true;
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

function peopleFits(restaurant, people) {
  return !people || restaurant.maxPeople >= (PEOPLE_REQUIRED[people] || 1);
}

function scoreRestaurant(restaurant, selection, filters) {
  let score = restaurant.star * 1.2 + Math.min(restaurant.fullReview.length / 100, 2.5);
  if (selection.occasion && selection.occasion !== "browse" && selection.occasion !== "explore") {
    const occasionMatches = {
      birthday: ["guest", "friends", "parents"],
      casual: ["browse", "solo", "friends"],
      talk: ["talk", "guest"]
    };
    const accepted = occasionMatches[selection.occasion] || [selection.occasion];
    score += accepted.some((occasion) => restaurant.occasions.indexOf(occasion) !== -1) ? 12 : -3;
  }
  const regions = selectedRegions(selection).filter((item) => item !== "不限区域");
  if (regions.length) {
    score += regions.some((region) => regionMatches(restaurant, region)) ? 14 : -8;
  }
  if (selection.people) score += peopleFits(restaurant, selection.people) ? 6 : -20;
  if (filters.cuisine) score += restaurant.cuisines.indexOf(filters.cuisine) !== -1 ? 10 : -18;
  if (filters.price) {
    const parts = filters.price.split("-").map(Number);
    const filterMin = parts[0];
    const filterMax = parts[1] || 9999;
    score += restaurant.priceMin < filterMax && restaurant.priceMax > filterMin ? 9 : -18;
  }
  if (filters.diet) score += restaurant.diet.indexOf(filters.diet) !== -1 ? 8 : -24;
  if (restaurant.reservationLevel === "easy") score += 1;
  return score;
}

function recommend(selection, filters, offset) {
  const activeRegions = selectedRegions(selection).filter((item) => item !== "不限区域");
  const ranked = restaurants
    .filter((restaurant) => !activeRegions.length || activeRegions.some((region) => regionMatches(restaurant, region)))
    .filter((restaurant) => peopleFits(restaurant, selection.people))
    .filter((restaurant) => !filters.cuisine || restaurant.cuisines.indexOf(filters.cuisine) !== -1)
    .filter((restaurant) => !filters.diet || restaurant.diet.indexOf(filters.diet) !== -1)
    .filter((restaurant) => {
      if (!filters.price) return true;
      const parts = filters.price.split("-").map(Number);
      return restaurant.priceMin < (parts[1] || 9999) && restaurant.priceMax > parts[0];
    })
    .map((restaurant) => ({ ...restaurant, score: scoreRestaurant(restaurant, selection, filters) }))
    .sort((a, b) => b.score - a.score || b.star - a.star);

  const count = Math.min(4, ranked.length);
  const start = ranked.length ? (offset * count) % ranked.length : 0;
  return ranked.slice(start, start + count).concat(
    start + count > ranked.length ? ranked.slice(0, start + count - ranked.length) : []
  );
}

function describeSelection(selection) {
  if (selection.occasion === "browse" || selection.occasion === "explore") {
    return "看看我都吃了什么——不设目的地，帮你发现一些值得去试试的地方。";
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
  return `${occasion}、${people}、${region}——${judgments[selection.occasion] || "这几家比较合适。"}`;
}

module.exports = { recommend, describeSelection, regionMatches, selectedRegions, OCCASION_LABELS, PEOPLE_LABELS };
