const presets = {
  date: { 场合: "约会" },
  guest: { 场合: "请客" },
  friends: { 场合: "好友聚餐" },
  parents: { 场合: "家庭聚餐" },
  solo: { 场合: "一人食" },
  birthday: { 场合: "生日" },
  casual: { 场合: "随便吃吃" },
  explore: { 场合: "探索" },
  talk: { 场合: "谈事" }
};

const PRIMARY_OPTIONS = [
  { id: "date", label: "约会", icon: "/assets/icons/date-red.png", tone: "plain" },
  { id: "guest", label: "请客", icon: "/assets/icons/guest-red.png", tone: "blue" },
  { id: "friends", label: "朋友聚会", icon: "/assets/icons/friends-white.png", tone: "red" },
  { id: "parents", label: "带爸妈", icon: "/assets/icons/parents-red.png", tone: "plain" },
  { id: "birthday", label: "过生日", icon: "/assets/icons/birthday-red.png", tone: "blue" },
  { id: "talk", label: "安静谈事", icon: "/assets/icons/talk-red.png", tone: "plain" }
];

const SECONDARY_OPTIONS = [
  { id: "solo", label: "一人食", icon: "/assets/icons/solo-red.png", tone: "plain" },
  { id: "casual", label: "随便吃点", icon: "/assets/icons/food-red.png", tone: "blue" }
];

const DEFAULT_PEOPLE = { solo: "1", date: "2" };

Page({
  data: { primaryOptions: PRIMARY_OPTIONS, secondaryOptions: SECONDARY_OPTIONS, selected: "" },

  onShow() {
    const selection = { occasion: "", tags: {}, people: "", regions: [] };
    const app = getApp();
    app.globalData.selection = selection;
    wx.setStorageSync("selection", selection);
    this.setData({ selected: "" });
  },

  chooseOccasion(event) {
    const occasion = event.currentTarget.dataset.id;
    this.setData({ selected: occasion });
    const app = getApp();
    app.globalData.selection.occasion = occasion;
    app.globalData.selection.tags = presets[occasion];
    app.globalData.selection.people = DEFAULT_PEOPLE[occasion] || "";
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
