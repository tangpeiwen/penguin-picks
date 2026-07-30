const { recommend, describeSelection } = require("../../utils/recommend");
const { orderDishData } = require("../../utils/order-card");

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
const CARD_WIDTH = 630;
const CARD_HEIGHT = 1000;

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.arcTo(x + width, y, x + width, y + radius, radius);
  context.lineTo(x + width, y + height - radius);
  context.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  context.lineTo(x + radius, y + height);
  context.arcTo(x, y + height, x, y + height - radius, radius);
  context.lineTo(x, y + radius);
  context.arcTo(x, y, x + radius, y, radius);
  context.closePath();
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const characters = Array.from(text || "");
  const lines = [];
  let line = "";
  characters.forEach((character) => {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = visibleLines[maxLines - 1];
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    visibleLines[maxLines - 1] = `${last}…`;
  }
  visibleLines.forEach((visibleLine, index) => context.fillText(visibleLine, x, y + index * lineHeight));
  return y + visibleLines.length * lineHeight;
}

function validCoordinate(item) {
  return Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
}

function locationSummary(item) {
  const region = (item.region || item.district || "上海").split(/[、,，/]/)[0];
  const building = item.building || "";
  if (!building || region.indexOf(building) !== -1 || building.indexOf(region) !== -1) return region;
  return `${region} · ${building}`;
}

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
    viewMode: "list",
    mapDisabled: true,
    mapLatitude: 31.2304,
    mapLongitude: 121.4737,
    mapMarkers: [],
    mapPoints: [],
    orderCard: null,
    shareImagePath: "",
    cardRendering: false
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
      locationSummary: locationSummary(item),
      cuisineLabel: item.cuisines.slice(0, 2).join(" · "),
      priceDisplay: `¥${item.priceLabel}/人`,
      ...orderDishData(item, this.data.selection.people),
      cardReview: item.fullReview || item.review,
      hasCoordinate: validCoordinate(item)
    }));
    const mapped = results.filter(validCoordinate);
    const mapMarkers = mapped.map((item, index) => ({
      id: index + 1,
      restaurantId: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      iconPath: "/assets/icons/location-red.png",
      width: 34,
      height: 42,
      callout: {
        content: item.name,
        color: "#84201f",
        fontSize: 13,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#decfbd",
        bgColor: "#fffdf8",
        padding: 7,
        display: "BYCLICK"
      }
    }));
    const mapDisabled = !mapped.length;
    this.setData({
      results,
      mapMarkers,
      mapPoints: mapped.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
      mapDisabled,
      mapLatitude: mapped.length ? mapped.reduce((sum, item) => sum + item.latitude, 0) / mapped.length : 31.2304,
      mapLongitude: mapped.length ? mapped.reduce((sum, item) => sum + item.longitude, 0) / mapped.length : 121.4737,
      viewMode: mapDisabled ? "list" : this.data.viewMode,
      orderCard: null,
      shareImagePath: "",
      cardRendering: false
    });
  },

  changeView(event) {
    this.setData({ viewMode: event.detail.value });
  },

  showMapUnavailable() {
    wx.showToast({ title: "当前结果暂无可用坐标", icon: "none" });
  },

  openMarkerLocation(event) {
    const marker = this.data.mapMarkers.find((item) => item.id === event.markerId);
    if (!marker) return;
    const restaurant = this.data.results.find((item) => item.id === marker.restaurantId);
    if (!restaurant) return;
    wx.openLocation({
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      name: restaurant.name,
      address: restaurant.address,
      scale: 17
    });
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

  openOrderCard(event) {
    const id = event.currentTarget.dataset.id;
    const orderCard = this.data.results.find((item) => item.id === id);
    if (!orderCard) return;
    this.setData({ orderCard, shareImagePath: "", cardRendering: false });
  },

  closeOrderCard() {
    this.setData({ orderCard: null, shareImagePath: "", cardRendering: false });
  },

  renderOrderCardImage(done) {
    const card = this.data.orderCard;
    if (!card) return;
    const context = wx.createCanvasContext("orderCardCanvas", this);
    context.setFillStyle("#f8f3e9");
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.setFillStyle("#a72f2e");
    context.fillRect(0, 0, CARD_WIDTH, 18);

    context.setFillStyle("#806e67");
    context.setFontSize(19);
    context.fillText("PENGUIN PICKS  ·  点 菜 卡", 48, 62);

    context.setFillStyle("#84201f");
    context.setFontSize(44);
    let y = drawWrappedText(context, card.name, 48, 116, 534, 50, 2) + 1;

    context.setFillStyle("#806e67");
    context.setFontSize(20);
    context.fillText(`${card.cuisineLabel}  ·  ${card.priceDisplay}`, 48, y);
    y += 31;
    context.setFontSize(18);
    context.fillText(card.locationSummary, 48, y);
    y += 35;

    context.setStrokeStyle("#decfbd");
    context.setLineWidth(2);
    context.setLineDash([8, 8], 0);
    context.beginPath();
    context.moveTo(48, y);
    context.lineTo(582, y);
    context.stroke();
    context.setLineDash([], 0);
    y += 30;

    if (card.cardDishes.length) {
      context.setFillStyle("#84201f");
      context.setFontSize(25);
      context.fillText(card.dishHeading, 48, y);
      y += 36;

      const gridTop = y;
      const dishWidth = 258;
      const dishHeight = 84;
      const gapX = 18;
      const gapY = 12;
      card.cardDishes.forEach((dish, index) => {
        const isWide = card.cardDishes.length % 2 === 1 && index === card.cardDishes.length - 1;
        const column = index % 2;
        const row = Math.floor(index / 2);
        const dishX = isWide ? 48 : 48 + column * (dishWidth + gapX);
        const dishY = gridTop + row * (dishHeight + gapY);
        const width = isWide ? 534 : dishWidth;
        context.setFillStyle("#efe2d5");
        roundRect(context, dishX, dishY, width, dishHeight, 17);
        context.fill();
        context.setFillStyle("#a72f2e");
        context.setFontSize(17);
        context.fillText(`${index + 1}`.padStart(2, "0"), dishX + 16, dishY + 31);
        context.setFillStyle("#3b2925");
        context.setFontSize(25);
        drawWrappedText(context, dish, dishX + 53, dishY + 32, width - 68, 27, 2);
      });
      y = gridTop + Math.ceil(card.cardDishes.length / 2) * (dishHeight + gapY) + 13;
    }

    context.setFillStyle("#84201f");
    context.setFontSize(23);
    context.fillText("我的一句话", 48, y);
    y += 36;
    context.setFillStyle("#5f504a");
    context.setFontSize(22);
    y = drawWrappedText(context, card.review, 48, y, 534, 29, 2) + 15;

    if (card.pitfall) {
      context.setFillStyle("#84201f");
      context.setFontSize(19);
      context.fillText("避雷", 48, y);
      context.setFillStyle("#5f504a");
      context.setFontSize(18);
      y = drawWrappedText(context, card.pitfall, 108, y, 474, 25, 2) + 10;
    }

    if (card.reservationDisplay) {
      context.setFillStyle("#84201f");
      context.setFontSize(19);
      context.fillText("订位", 48, y);
      context.setFillStyle("#5f504a");
      context.setFontSize(18);
      y = drawWrappedText(context, card.reservationDisplay, 108, y, 474, 25, 1) + 10;
    }

    context.setFillStyle("#806e67");
    context.setFontSize(17);
    drawWrappedText(context, card.address, 48, Math.min(y, 930), 534, 23, 1);
    context.setTextAlign("right");
    context.fillText("截图留着，点菜不慌", 582, 972);
    context.setTextAlign("left");

    context.draw(false, () => {
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId: "orderCardCanvas",
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          destWidth: CARD_WIDTH * 2,
          destHeight: CARD_HEIGHT * 2,
          fileType: "png",
          quality: 1,
          success: (result) => {
            this.setData({ shareImagePath: result.tempFilePath, cardRendering: false });
            if (done) done(result.tempFilePath);
          },
          fail: () => {
            this.setData({ cardRendering: false });
            wx.showToast({ title: "图片生成失败，请重试", icon: "none" });
          }
        }, this);
      }, 80);
    });
  },

  withOrderCardImage(callback) {
    if (this.data.shareImagePath) {
      callback(this.data.shareImagePath);
      return;
    }
    this.setData({ cardRendering: true }, () => this.renderOrderCardImage(callback));
  },

  saveOrderCard() {
    this.withOrderCardImage((filePath) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => wx.showToast({ title: "点菜卡已保存", icon: "success" }),
        fail: (error) => {
          if ((error.errMsg || "").indexOf("auth deny") !== -1) {
            wx.showModal({
              title: "需要相册权限",
              content: "请在设置中允许保存图片到相册。",
              success: (result) => { if (result.confirm) wx.openSetting(); }
            });
          } else {
            wx.showToast({ title: "保存失败，请在真机重试", icon: "none" });
          }
        }
      });
    });
  },

  copyText(event) {
    const value = event.currentTarget.dataset.value;
    const label = event.currentTarget.dataset.label || "内容";
    if (!value) return;
    wx.setClipboardData({ data: value, success: () => wx.showToast({ title: `${label}已复制`, icon: "none" }) });
  },

  openLocation(event) {
    const id = event.currentTarget.dataset.id;
    const restaurant = this.data.results.find((item) => item.id === id) || this.data.orderCard;
    if (!restaurant || !validCoordinate(restaurant)) {
      wx.showToast({ title: "当前餐厅暂无可用坐标", icon: "none" });
      return;
    }
    wx.openLocation({
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      name: restaurant.name,
      address: restaurant.address,
      scale: 17
    });
  }
});
