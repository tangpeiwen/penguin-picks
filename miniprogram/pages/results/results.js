const { recommend, describeSelection } = require("../../utils/recommend");

const FILTER_OPTIONS = {
  cuisine: [
    { id: "日料", label: "日料" },
    { id: "本帮菜", label: "本帮菜" },
    { id: "创意菜", label: "创意菜" },
    { id: "潮汕菜", label: "潮汕菜" },
    { id: "粤菜", label: "粤菜" }
  ],
  price: [
    { id: "0-200", label: "¥200 以下" },
    { id: "200-300", label: "¥200–300" },
    { id: "300-500", label: "¥300–500" },
    { id: "500-9999", label: "¥500 以上" }
  ],
  diet: [
    { id: "no-spicy", label: "不吃辣" },
    { id: "no-seafood", label: "不吃海鲜" },
    { id: "vegetarian", label: "需要素食选择" }
  ]
};

const FILTER_LABELS = { cuisine: "菜系", price: "人均", diet: "忌口" };

Page({
  data: {
    selection: {},
    summary: "",
    results: [],
    filters: { cuisine: "", price: "", diet: "" },
    filterLabels: { cuisine: "菜系", price: "人均", diet: "忌口" },
    activeFilter: "",
    activeTitle: "",
    activeOptions: [],
    offset: 0,
    expandedId: ""
  },

  onLoad() {
    const selection = wx.getStorageSync("selection") || { occasion: "browse", people: "", region: "" };
    this.setData({ selection, summary: describeSelection(selection) }, () => this.refresh());
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: "/pages/occasion/occasion" });
    }
  },

  refresh() {
    const results = recommend(this.data.selection, this.data.filters, this.data.offset).map((item) => ({
      ...item,
      location: item.region || item.district || "上海",
      cuisineLabel: item.cuisines.slice(0, 2).join(" · ")
    }));
    this.setData({ results, expandedId: "" });
  },

  openFilter(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ activeFilter: key, activeTitle: FILTER_LABELS[key], activeOptions: FILTER_OPTIONS[key] });
  },

  closeFilter() { this.setData({ activeFilter: "" }); },

  noop() {},

  chooseFilter(event) {
    const key = this.data.activeFilter;
    const value = event.currentTarget.dataset.value;
    const label = event.currentTarget.dataset.label;
    this.setData({
      [`filters.${key}`]: value,
      [`filterLabels.${key}`]: label,
      activeFilter: "",
      offset: 0
    }, () => this.refresh());
  },

  clearFilter() {
    const key = this.data.activeFilter;
    this.setData({
      [`filters.${key}`]: "",
      [`filterLabels.${key}`]: FILTER_LABELS[key],
      activeFilter: "",
      offset: 0
    }, () => this.refresh());
  },

  changeBatch() {
    this.setData({ offset: this.data.offset + 1 }, () => this.refresh());
  },

  toggleDetail(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? "" : id });
  },

  copyAddress(event) {
    const address = event.currentTarget.dataset.address;
    if (!address) return;
    wx.setClipboardData({ data: address, success: () => wx.showToast({ title: "地址已复制", icon: "none" }) });
  }
});
