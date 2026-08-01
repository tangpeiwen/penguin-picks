const assert = require("node:assert/strict");

let pageDefinition;
const operations = [];
let textAlign = "left";
let textBaseline = "alphabetic";

const context = {
  setFillStyle() {},
  fillRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  arcTo() {},
  closePath() {},
  fill() {},
  setStrokeStyle() {},
  setLineWidth() {},
  setLineDash() {},
  stroke() {},
  setFontSize() {},
  setTextAlign(value) { textAlign = value; },
  setTextBaseline(value) { textBaseline = value; },
  measureText(text) { return { width: Array.from(text).length * 20 }; },
  fillText(text, x, y) { operations.push({ type: "text", text, x, y, textAlign, textBaseline }); },
  drawImage(path, x, y, width, height) { operations.push({ type: "image", path, x, y, width, height }); },
  draw(_reserve, callback) { callback(); }
};

Object.defineProperty(context, "font", {
  set(value) { operations.push({ type: "font", value }); }
});

global.Page = (definition) => { pageDefinition = definition; };
global.wx = {
  createCanvasContext() { return context; },
  canvasToTempFilePath(options) {
    operations.push({ type: "export", options });
    options.success({ tempFilePath: "/tmp/order-card.png" });
  },
  showToast() {}
};

require("../miniprogram/pages/results/results");

const page = {
  ...pageDefinition,
  data: {
    ...pageDefinition.data,
    orderCard: {
      name: "测试餐厅",
      cuisineLabel: "中餐",
      priceDisplay: "¥200-300/人",
      locationSummary: "静安寺",
      dishHeading: "点菜参考",
      cardDishes: ["鱼头", "公鸡", "乌米饭"],
      review: "适合朋友聚餐。",
      pitfall: "",
      reservationDisplay: "",
      address: "上海市测试路1号"
    }
  },
  setData(patch) { Object.assign(this.data, patch); }
};

page.renderOrderCardImage(() => {
  const handFont = operations.find((item) => item.type === "font" && item.value.includes("STKaiti"));
  assert.ok(handFont, "export should use a native Canvas handwriting font");

  const dishText = operations.find((item) => item.type === "text" && item.text === "鱼头");
  assert.equal(dishText.textAlign, "center", "dish names should be horizontally centered");
  assert.equal(dishText.textBaseline, "middle", "dish names should be vertically centered");

  const miniProgramCode = operations.find((item) => item.type === "image");
  assert.equal(miniProgramCode.path, "/assets/miniprogram-code.jpg", "export should draw the official mini program code");

  const exportOperation = operations.find((item) => item.type === "export");
  assert.ok(exportOperation.options.height < 1000, "short cards should not keep a large fixed blank area");
  assert.ok(exportOperation.options.height <= 1300);
  assert.equal(exportOperation.options.destHeight, exportOperation.options.height * 2);

  const addressText = operations.find((item) => item.type === "text" && item.text === "上海市测试路1号");
  assert.ok(miniProgramCode.y - addressText.y >= 70, "footer should have breathing room after the address");
  assert.ok(miniProgramCode.y - addressText.y <= 110, "footer should stay close to short content");

  console.log("Order-card image check passed: handwriting font, centered dishes, compact flow, and mini program code are rendered.");
});
