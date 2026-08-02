const { recommend, recommendAll, describeSelectionParts, defaultPriceFilter } = require("../../utils/recommend");
const { orderDishData } = require("../../utils/order-card");

const FILTER_OPTIONS = {
  cuisine: [
    { id: "中餐", label: "中餐" },
    { id: "日料", label: "日料" },
    { id: "西餐", label: "西餐" },
    { id: "火锅", label: "火锅" },
    { id: "东南亚", label: "东南亚" },
    { id: "韩餐", label: "韩餐" }
  ],
  price: [
    { id: "any", label: "不限", full: true },
    { id: "0-100", label: "¥100以内" },
    { id: "100-200", label: "¥200以内" },
    { id: "200-300", label: "¥300以内" },
    { id: "300-500", label: "¥500以内" },
    { id: "500-700", label: "¥700以内" },
    { id: "700-9999", label: "¥700+" }
  ],
  diet: [
    { id: "no-spicy", label: "不吃辣" },
    { id: "no-seafood", label: "不吃海鲜" },
    { id: "no-beef", label: "不吃牛肉" },
    { id: "vegetarian", label: "素食" }
  ]
};

const FILTER_LABELS = { cuisine: "菜系", price: "人均预算", diet: "忌口" };
const CARD_WIDTH = 630;
const CARD_MAX_HEIGHT = 1300;
const CARD_FOOTER_HEIGHT = 170;
const LOADING_DELAY = 280;
// Native Canvas cannot use fonts registered through wx.loadFontFace. Use one
// system handwriting family directly so iOS does not fall back to PingFang.
const HAND_FONT = "STKaiti";
const BODY_FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
const MINI_PROGRAM_CODE_PATH = "/assets/miniprogram-code.jpg";
const AREA_LABELS = { "衡山复兴": "衡山路/复兴西路", "古北虹桥": "古北/虹桥" };
const HAND_FONT_MISSING_HAN = /[園專葉記鄉鄧門雲鮨鮮緣]/;

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

function wrappedLines(context, text, maxWidth, maxLines) {
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
  return visibleLines;
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const visibleLines = wrappedLines(context, text, maxWidth, maxLines);
  visibleLines.forEach((visibleLine, index) => context.fillText(visibleLine, x, y + index * lineHeight));
  return y + visibleLines.length * lineHeight;
}

function setCanvasFont(context, size, family = BODY_FONT) {
  if (typeof context.setFontSize === "function") context.setFontSize(size);
  context.font = `normal 400 ${size}px ${family}`;
}

function drawCenteredWrappedText(context, text, centerX, centerY, maxWidth, lineHeight, maxLines) {
  const lines = wrappedLines(context, text, maxWidth, maxLines);
  const firstBaseline = centerY - ((lines.length - 1) * lineHeight) / 2;
  context.setTextAlign("center");
  context.setTextBaseline("middle");
  lines.forEach((line, index) => context.fillText(line, centerX, firstBaseline + index * lineHeight));
  context.setTextAlign("left");
  context.setTextBaseline("alphabetic");
}

function validCoordinate(item) {
  return Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
}

function locationSummary(item) {
  const area = Array.isArray(item.areas) && item.areas.length ? item.areas[0] : "";
  const region = AREA_LABELS[area] || area || item.region || item.district || "上海";
  return region;
}

function queueException(item) {
  if (!item || item.reservationLevel === "easy" || item.reservationLabel === "可提前订") return "";
  return item.reservationLabel || "";
}

function listBadges(item) {
  return [
    item.privateRoom ? "有包间" : "",
    queueException(item)
  ].filter(Boolean);
}

function navigationContentTop() {
  try {
    if (typeof wx.getMenuButtonBoundingClientRect === "function") {
      const menuRect = wx.getMenuButtonBoundingClientRect();
      if (menuRect && Number.isFinite(menuRect.bottom) && menuRect.bottom > 0) return Math.ceil(menuRect.bottom + 4);
    }
    const windowInfo = typeof wx.getWindowInfo === "function"
      ? wx.getWindowInfo()
      : (typeof wx.getSystemInfoSync === "function" ? wx.getSystemInfoSync() : {});
    return Math.ceil((windowInfo.statusBarHeight || 24) + 48);
  } catch (error) {
    return 78;
  }
}

function selectedFilterLabel(key, values) {
  if (!values.length) return FILTER_LABELS[key];
  if (values.length === 1) {
    const option = FILTER_OPTIONS[key].find((item) => item.id === values[0]);
    return option ? option.label : FILTER_LABELS[key];
  }
  return `${FILTER_LABELS[key]} · ${values.length}`;
}

Page({
  data: {
    contentTop: 78,
    selection: {},
    summary: { occasion: "", details: "", judgment: "" },
    results: [],
    loading: true,
    filters: { cuisine: [], price: [], diet: [], visitStatus: [] },
    filterLabels: { cuisine: "菜系", price: "人均预算", diet: "忌口" },
    activeFilter: "",
    activeTitle: "",
    activeOptions: [],
    draftValues: [],
    offset: 0,
    viewMode: "list",
    mapDisabled: true,
    mapLatitude: 31.2304,
    mapLongitude: 121.4737,
    mapMarkers: [],
    mapPoints: [],
    mapRestaurants: [],
    orderCard: null,
    shareImagePath: "",
    cardRendering: false,
    isExplore: false,
    browseTab: "visited",
    hasPrevious: false,
    hasMore: false,
    emptyText: "这个组合我还真没吃到过"
  },

  onLoad() {
    const selection = wx.getStorageSync("selection") || { occasion: "browse", people: "", region: "" };
    const defaultPrices = defaultPriceFilter(selection);
    const isExplore = selection.occasion === "explore" || selection.occasion === "browse";
    this.setData({
      contentTop: navigationContentTop(),
      selection,
      summary: describeSelectionParts(selection),
      filters: { cuisine: [], price: defaultPrices, diet: [], visitStatus: isExplore ? ["visited"] : [] },
      isExplore,
      browseTab: "visited",
      filterLabels: { cuisine: "菜系", price: selectedFilterLabel("price", defaultPrices), diet: "忌口" }
    }, () => this.refresh());
  },

  onResize() {
    this.setData({ contentTop: navigationContentTop() });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: "/pages/occasion/occasion" });
    }
  },

  goHome() {
    wx.reLaunch({ url: "/pages/occasion/occasion" });
  },

  refresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.setData({ loading: true, orderCard: null, shareImagePath: "", cardRendering: false });
    this.refreshTimer = setTimeout(() => {
      const results = recommend(this.data.selection, this.data.filters, this.data.offset).map((item) => ({
        ...item,
        location: item.region || item.district || "上海",
        locationSummary: locationSummary(item),
        cuisineLabel: item.cuisines.slice(0, 2).join(" · "),
        priceDisplay: `¥${item.priceLabel}/人`,
        ...orderDishData(item),
        cardReview: item.fullReview || item.review,
        listBadges: listBadges(item),
        fallbackNameFont: HAND_FONT_MISSING_HAN.test(item.name),
        detailLabel: item.visited ? "点菜卡" : "待吃卡",
        reviewHeading: item.visited ? "我的一句话" : "为什么想去",
        hasCoordinate: validCoordinate(item)
      }));
      const allMatches = recommendAll(this.data.selection, this.data.filters);
      const mapped = allMatches.filter(validCoordinate);
      const mapMarkers = mapped.map((item, index) => ({
        id: index + 1,
        restaurantId: item.id,
        latitude: item.latitude,
        longitude: item.longitude,
        iconPath: "/assets/icons/map-marker-red.png",
        width: 27,
        height: 33,
        anchor: { x: 0.5, y: 1 },
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
        loading: false,
        mapMarkers,
        mapPoints: mapped.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
        mapRestaurants: mapped,
        mapDisabled,
        hasPrevious: this.data.offset > 0,
        hasMore: (this.data.offset + 1) * 3 < allMatches.length,
        mapLatitude: mapped.length ? mapped.reduce((sum, item) => sum + item.latitude, 0) / mapped.length : 31.2304,
        mapLongitude: mapped.length ? mapped.reduce((sum, item) => sum + item.longitude, 0) / mapped.length : 121.4737,
        emptyText: this.data.isExplore && this.data.browseTab === "wishlist" ? "待吃清单里还没有符合的餐厅" : "这个组合我还真没吃到过",
        viewMode: mapDisabled ? "list" : this.data.viewMode
      });
      this.refreshTimer = null;
    }, LOADING_DELAY);
  },

  onUnload() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  },

  changeView(event) {
    this.setData({ viewMode: event.detail.value });
  },

  showMapUnavailable() {
    wx.showToast({ title: "当前结果暂无可用坐标", icon: "none" });
  },

  openMarkerLocation(event) {
    const markerId = event.detail && event.detail.markerId !== undefined ? event.detail.markerId : event.markerId;
    const marker = this.data.mapMarkers.find((item) => item.id === markerId);
    if (!marker) return;
    const restaurant = this.data.mapRestaurants.find((item) => item.id === marker.restaurantId);
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
    const draftValues = [...this.data.filters[key]];
    this.setData({
      activeFilter: key,
      activeTitle: FILTER_LABELS[key],
      activeOptions: FILTER_OPTIONS[key].map((item) => ({
        ...item,
        selected: item.id === "any" ? !draftValues.length : draftValues.indexOf(item.id) !== -1
      })),
      draftValues
    });
  },

  closeFilter() { this.setData({ activeFilter: "", draftValues: [] }); },

  noop() {},

  toggleFilterOption(event) {
    const value = event.currentTarget.dataset.value;
    let draftValues;
    if (this.data.activeFilter === "price") {
      draftValues = value === "any" || this.data.draftValues.indexOf(value) !== -1 ? [] : [value];
    } else {
      draftValues = this.data.draftValues.indexOf(value) === -1
        ? [...this.data.draftValues, value]
        : this.data.draftValues.filter((item) => item !== value);
    }
    this.setData({
      draftValues,
      activeOptions: this.data.activeOptions.map((item) => ({
        ...item,
        selected: item.id === "any" ? !draftValues.length : draftValues.indexOf(item.id) !== -1
      }))
    });
  },

  resetDraftFilter() {
    this.setData({
      draftValues: [],
      activeOptions: this.data.activeOptions.map((item) => ({ ...item, selected: item.id === "any" }))
    });
  },

  applyFilter() {
    const key = this.data.activeFilter;
    const values = [...this.data.draftValues];
    this.setData({
      [`filters.${key}`]: values,
      [`filterLabels.${key}`]: selectedFilterLabel(key, values),
      activeFilter: "",
      draftValues: [],
      offset: 0
    }, () => this.refresh());
  },

  changeBatch() {
    this.setData({ offset: this.data.offset + 1 }, () => this.refresh());
  },

  previousBatch() {
    if (this.data.offset <= 0) return;
    this.setData({ offset: this.data.offset - 1 }, () => this.refresh());
  },

  changeBrowseTab(event) {
    const browseTab = event.currentTarget.dataset.tab;
    if (browseTab === this.data.browseTab) return;
    this.setData({
      browseTab,
      offset: 0,
      "filters.visitStatus": [browseTab]
    }, () => this.refresh());
  },

  openOrderCardById(id) {
    const orderCard = this.data.results.find((item) => item.id === id);
    if (!orderCard) return;
    this.setData({ orderCard, shareImagePath: "", cardRendering: false });
  },

  openOrderCard(event) {
    this.openOrderCardById(event.currentTarget.dataset.id);
  },

  closeOrderCard() {
    this.setData({ orderCard: null, shareImagePath: "", cardRendering: false });
  },

  renderOrderCardImage(done) {
    const card = this.data.orderCard;
    if (!card) return;
    const context = wx.createCanvasContext("orderCardCanvas", this);
    context.setFillStyle("#f8f3e9");
    context.fillRect(0, 0, CARD_WIDTH, CARD_MAX_HEIGHT);
    context.setFillStyle("#a72f2e");
    context.fillRect(0, 0, CARD_WIDTH, 18);

    context.setFillStyle("#806e67");
    setCanvasFont(context, 19);
    context.fillText(`PEIWEN PICKS  ·  ${card.visited ? "点 菜 卡" : "待 吃 卡"}`, 48, 62);

    context.setFillStyle("#84201f");
    setCanvasFont(context, 44, HAND_FONT);
    let y = drawWrappedText(context, card.name, 48, 124, 534, 52, 2) + 18;

    context.setFillStyle("#806e67");
    setCanvasFont(context, 20);
    context.fillText(`${card.cuisineLabel}  ·  ${card.priceDisplay}`, 48, y);
    y += 34;
    setCanvasFont(context, 18);
    context.fillText(card.locationSummary, 48, y);
    y += 46;

    context.setStrokeStyle("#decfbd");
    context.setLineWidth(2);
    context.setLineDash([8, 8], 0);
    context.beginPath();
    context.moveTo(48, y);
    context.lineTo(582, y);
    context.stroke();
    context.setLineDash([], 0);
    y += 38;

    if (card.cardDishes.length) {
      context.setFillStyle("#84201f");
      setCanvasFont(context, 25, HAND_FONT);
      context.fillText(card.dishHeading, 48, y);
      y += 45;

      const gridTop = y;
      const dishWidth = 258;
      const dishHeight = 84;
      const gapX = 18;
      const gapY = 14;
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
        setCanvasFont(context, 17);
        context.setTextBaseline("middle");
        context.fillText(`${index + 1}`.padStart(2, "0"), dishX + 16, dishY + dishHeight / 2);
        context.setTextBaseline("alphabetic");
        context.setFillStyle("#3b2925");
        setCanvasFont(context, 25, HAND_FONT);
        drawCenteredWrappedText(context, dish, dishX + width / 2, dishY + dishHeight / 2, width - 92, 29, 2);
      });
      const gridRows = Math.ceil(card.cardDishes.length / 2);
      y = gridTop + gridRows * dishHeight + Math.max(0, gridRows - 1) * gapY + 42;
    }

    context.setFillStyle("#84201f");
    setCanvasFont(context, 23, HAND_FONT);
    context.fillText(card.reviewHeading, 48, y);
    y += 44;
    context.setFillStyle("#5f504a");
    setCanvasFont(context, 22);
    y = drawWrappedText(context, card.review, 48, y, 534, 32, 2) + 24;

    if (card.pitfall) {
      context.setFillStyle("#84201f");
      setCanvasFont(context, 19, HAND_FONT);
      context.fillText("避雷", 48, y);
      context.setFillStyle("#5f504a");
      setCanvasFont(context, 18);
      y = drawWrappedText(context, card.pitfall, 108, y, 474, 28, 2) + 22;
    }

    if (card.reservationDisplay) {
      context.setFillStyle("#84201f");
      setCanvasFont(context, 19, HAND_FONT);
      context.fillText("订位", 48, y);
      context.setFillStyle("#5f504a");
      setCanvasFont(context, 18);
      y = drawWrappedText(context, card.reservationDisplay, 108, y, 474, 28, 1) + 22;
    }

    context.setFillStyle("#806e67");
    setCanvasFont(context, 17);
    const addressBottom = drawWrappedText(context, card.address, 48, y + 8, 534, 25, 1);
    const footerTop = Math.min(addressBottom + 44, CARD_MAX_HEIGHT - CARD_FOOTER_HEIGHT);
    const exportHeight = footerTop + CARD_FOOTER_HEIGHT;

    context.setStrokeStyle("#decfbd");
    context.setLineWidth(2);
    context.setLineDash([8, 8], 0);
    context.beginPath();
    context.moveTo(48, footerTop);
    context.lineTo(582, footerTop);
    context.stroke();
    context.setLineDash([], 0);

    context.drawImage(MINI_PROGRAM_CODE_PATH, 48, footerTop + 20, 116, 116);
    context.setFillStyle("#84201f");
    setCanvasFont(context, 24, HAND_FONT);
    context.fillText("微信扫一扫", 184, footerTop + 57);
    context.setFillStyle("#806e67");
    setCanvasFont(context, 17);
    context.fillText("打开 PEIWEN PICKS", 184, footerTop + 87);
    context.setTextAlign("right");
    setCanvasFont(context, 18, HAND_FONT);
    context.fillText(card.visited ? "截图留着，点菜不慌" : "收好这张，找天去吃", 582, footerTop + 132);
    context.setTextAlign("left");

    context.draw(false, () => {
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId: "orderCardCanvas",
          width: CARD_WIDTH,
          height: exportHeight,
          destWidth: CARD_WIDTH * 2,
          destHeight: exportHeight * 2,
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
        success: () => wx.showToast({ title: `${this.data.orderCard.visited ? "点菜卡" : "待吃卡"}已保存`, icon: "success" }),
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
    this.openLocationById(event.currentTarget.dataset.id);
  },

  openLocationById(id) {
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
