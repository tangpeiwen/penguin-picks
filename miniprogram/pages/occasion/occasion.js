const presets = {
  date: { 场合: "约会" },
  guest: { 场合: "商务" },
  friends: { 场合: "好友聚餐" },
  parents: { 场合: "家庭聚餐" },
  solo: { 场合: "一人食" },
  birthday: { 场合: "生日" },
  casual: { 场合: "随便吃吃" },
  explore: { 场合: "探索" },
  talk: { 场合: "商务" }
};

const PRIMARY_OPTIONS = [
  { id: "date", label: "约会", icon: "/assets/icons/date-red.png", tone: "plain" },
  { id: "guest", label: "招待客人", icon: "/assets/icons/guest-red.png", tone: "blue" },
  { id: "friends", label: "朋友聚会", icon: "/assets/icons/friends-white.png", tone: "red" },
  { id: "parents", label: "带爸妈", icon: "/assets/icons/parents-red.png", tone: "blue" },
  { id: "birthday", label: "过生日", icon: "/assets/icons/food-red.png", tone: "plain" },
  { id: "talk", label: "安静谈事", icon: "/assets/icons/talk-red.png", tone: "plain" }
];

const SECONDARY_OPTIONS = [
  { id: "solo", label: "一人食", icon: "/assets/icons/solo-red.png", tone: "blue" },
  { id: "casual", label: "随便吃点", icon: "/assets/icons/cuisine-red.png", tone: "plain" }
];

Page({
  data: { primaryOptions: PRIMARY_OPTIONS, secondaryOptions: SECONDARY_OPTIONS, selected: "" },

  chooseOccasion(event) {
    const occasion = event.currentTarget.dataset.id;
    this.setData({ selected: occasion });
    const app = getApp();
    app.globalData.selection.occasion = occasion;
    app.globalData.selection.tags = presets[occasion];
    wx.setStorageSync("selection", app.globalData.selection);
    setTimeout(() => wx.navigateTo({ url: "/pages/preferences/preferences" }), 130);
  },

  explore() {
    const app = getApp();
    app.globalData.selection = { occasion: "explore", tags: presets.explore, people: "", regions: [] };
    wx.setStorageSync("selection", app.globalData.selection);
    wx.navigateTo({ url: "/pages/results/results?explore=1" });
  }
});
