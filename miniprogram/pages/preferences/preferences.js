const PEOPLE = [
  { id: "upto4", label: "4人以内", icon: "/assets/icons/table-4-illustrated.png", activeIcon: "/assets/icons/table-4-illustrated.png" },
  { id: "5-6", label: "5–6人", icon: "/assets/icons/table-6-illustrated.png", activeIcon: "/assets/icons/table-6-illustrated.png" },
  { id: "7-8", label: "7–8人", icon: "/assets/icons/table-8-illustrated.png", activeIcon: "/assets/icons/table-8-illustrated.png" },
  { id: "9+", label: "9人以上", icon: "/assets/icons/table-9-illustrated.png", activeIcon: "/assets/icons/table-9-illustrated.png" }
];

const { REGION_OPTIONS } = require("../../config/regions");
const { MEAL_OPTIONS } = require("../../config/meals");

function decorateRegions(selectedRegions) {
  return REGION_OPTIONS.map((item) => ({
    ...item,
    selected: selectedRegions.indexOf(item.id) !== -1
  }));
}

function decorateMeals(selectedMeals) {
  return MEAL_OPTIONS.map((item) => ({
    ...item,
    selected: selectedMeals.indexOf(item.id) !== -1
  }));
}

function normalizeMeals(selection) {
  const validMeals = MEAL_OPTIONS.map((item) => item.id);
  const storedMeals = Array.isArray(selection.meals)
    ? selection.meals
    : (selection.meal ? [selection.meal] : ["any"]);
  const selectedMeals = storedMeals.filter((item) => validMeals.indexOf(item) !== -1);
  if (!selectedMeals.length || selectedMeals.indexOf("any") !== -1) return ["any"];
  return selectedMeals;
}

function normalizePeople(value) {
  if (["upto4", "5-6", "7-8", "9+"].indexOf(value) !== -1) return value;
  if (value === "3-5" || value === "6+") return "5-6";
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return "";
  if (count <= 4) return "upto4";
  if (count <= 6) return "5-6";
  if (count <= 8) return "7-8";
  return "9+";
}

Page({
  data: {
    peopleOptions: PEOPLE,
    mealOptions: decorateMeals(["any"]),
    regions: decorateRegions([]),
    people: "",
    meals: ["any"],
    peopleRequired: true,
    pageTitle: "几个人？ 在哪里？",
    selectedRegions: [],
    ready: false
  },

  onLoad() {
    const selection = wx.getStorageSync("selection") || {};
    const validRegions = REGION_OPTIONS.map((item) => item.id);
    const storedRegions = Array.isArray(selection.regions)
      ? selection.regions
      : (selection.region ? [selection.region] : []);
    const selectedRegions = storedRegions.filter((item) => validRegions.indexOf(item) !== -1);
    const selectedMeals = normalizeMeals(selection);
    const peopleRequired = ["solo", "date"].indexOf(selection.occasion) === -1;
    const automaticPeople = selection.occasion === "solo" ? "1" : "2";
    this.setData({
      people: peopleRequired ? normalizePeople(selection.people) : automaticPeople,
      meals: selectedMeals,
      mealOptions: decorateMeals(selectedMeals),
      peopleRequired,
      pageTitle: peopleRequired ? "几个人？ 在哪里？" : "想去哪里？",
      selectedRegions,
      regions: decorateRegions(selectedRegions)
    });
    this.updateReady();
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: "/pages/occasion/occasion" });
    }
  },

  choosePeople(event) {
    this.setData({ people: event.currentTarget.dataset.id }, () => this.updateReady());
  },

  chooseMeal(event) {
    const meal = event.currentTarget.dataset.id || "any";
    let selectedMeals = this.data.meals.slice();
    if (meal === "any") {
      selectedMeals = ["any"];
    } else {
      selectedMeals = selectedMeals.filter((item) => item !== "any");
      const index = selectedMeals.indexOf(meal);
      if (index === -1) selectedMeals.push(meal);
      else selectedMeals.splice(index, 1);
      if (!selectedMeals.length) selectedMeals = ["any"];
    }
    this.setData({ meals: selectedMeals, mealOptions: decorateMeals(selectedMeals) });
  },

  chooseRegion(event) {
    const region = event.currentTarget.dataset.region;
    let selectedRegions = this.data.selectedRegions.slice();
    if (region === "不限区域") {
      selectedRegions = selectedRegions.indexOf(region) === -1 ? [region] : [];
    } else {
      selectedRegions = selectedRegions.filter((item) => item !== "不限区域");
      const index = selectedRegions.indexOf(region);
      if (index === -1) selectedRegions.push(region);
      else selectedRegions.splice(index, 1);
    }
    this.setData({ selectedRegions, regions: decorateRegions(selectedRegions) }, () => this.updateReady());
  },

  updateReady() {
    this.setData({ ready: Boolean((!this.data.peopleRequired || this.data.people) && this.data.selectedRegions.length) });
  },

  submit() {
    if (!this.data.ready) return;
    const selection = wx.getStorageSync("selection") || {};
    selection.people = this.data.people;
    selection.meals = this.data.meals.length ? this.data.meals : ["any"];
    delete selection.meal;
    selection.regions = this.data.selectedRegions;
    delete selection.region;
    getApp().globalData.selection = selection;
    wx.setStorageSync("selection", selection);
    wx.navigateTo({ url: "/pages/results/results" });
  }
});
