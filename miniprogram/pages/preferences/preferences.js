const PEOPLE = [
  { id: "1", label: "1人", icon: "/assets/icons/people-1-red.png", activeIcon: "/assets/icons/people-1-white.png" },
  { id: "2", label: "2人", icon: "/assets/icons/people-2-red.png", activeIcon: "/assets/icons/people-2-white.png" },
  { id: "3-5", label: "3–5人", icon: "/assets/icons/people-4-red.png", activeIcon: "/assets/icons/people-4-white.png" },
  { id: "6+", label: "6人+", icon: "/assets/icons/people-6-red.png", activeIcon: "/assets/icons/people-6-white.png" }
];

const { REGION_OPTIONS } = require("../../config/regions");

function decorateRegions(selectedRegions) {
  return REGION_OPTIONS.map((item) => ({
    ...item,
    selected: selectedRegions.indexOf(item.id) !== -1
  }));
}

Page({
  data: { peopleOptions: PEOPLE, regions: decorateRegions([]), people: "", selectedRegions: [], ready: false },

  onLoad() {
    const selection = wx.getStorageSync("selection") || {};
    const validRegions = REGION_OPTIONS.map((item) => item.id);
    const storedRegions = Array.isArray(selection.regions)
      ? selection.regions
      : (selection.region ? [selection.region] : []);
    const selectedRegions = storedRegions.filter((item) => validRegions.indexOf(item) !== -1);
    this.setData({
      people: selection.people || "",
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

  updateReady() { this.setData({ ready: Boolean(this.data.people && this.data.selectedRegions.length) }); },

  submit() {
    if (!this.data.ready) return;
    const selection = wx.getStorageSync("selection") || {};
    selection.people = this.data.people;
    selection.regions = this.data.selectedRegions;
    delete selection.region;
    getApp().globalData.selection = selection;
    wx.setStorageSync("selection", selection);
    wx.navigateTo({ url: "/pages/results/results" });
  }
});
