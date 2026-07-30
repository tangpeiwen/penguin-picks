/*
在已登录的 https://www.dianping.com/ 页面 Console 中运行。

与 fetch 版不同：本脚本会打开一个工作标签页，逐个进行真实页面导航，
再从加载完成的详情页 DOM 中读取餐厅种类、商圈、推荐菜、人均价格、图片和营业信息。
默认只测试 5 家；不会修改收藏或覆盖原始 CSV。
*/
(function () {
  const BATCH_SIZE = 5;
  const PAGE_TIMEOUT_MS = 60000;
  const BETWEEN_PAGES_MS = 12000;
  const STORAGE_KEY = "dp_navigation_extract_state_v1";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (char === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n" || char === "\r") {
        if (cell !== "" || row.length > 0) {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        }
        if (char === "\r" && next === "\n") i += 1;
      } else {
        cell += char;
      }
    }
    if (cell !== "" || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function ensureColumn(rows, preferredName, aliases = []) {
    const headers = rows[0];
    let index = headers.findIndex((header) => [preferredName, ...aliases].includes(header));
    if (index >= 0) {
      headers[index] = preferredName;
      return index;
    }
    index = headers.length;
    headers.push(preferredName);
    rows.slice(1).forEach((row) => row.push(""));
    return index;
  }

  function uniqueTexts(elements, splitRegions = false) {
    const values = [];
    elements.forEach((element) => {
      const text = element.textContent.replace(/\s+/g, " ").trim();
      const parts = splitRegions ? text.split(/\s*[/／、|]\s*/) : [text];
      parts.forEach((part) => {
        if (part && !values.includes(part)) values.push(part);
      });
    });
    return values;
  }

  function extractFromDocument(doc) {
    let category = uniqueTexts(doc.querySelectorAll("span.category.wx-text")).join("、");
    let region = uniqueTexts(doc.querySelectorAll("span.region.wx-text"), true).join("、");
    if (!category) {
      category = uniqueTexts(doc.querySelectorAll('[class*="category"]')).join("、");
    }
    if (!region) {
      region = uniqueTexts(doc.querySelectorAll('[class*="region"]'), true).join("、");
    }

    const dishes = new Set();
    [
      ".dishName.wx-view",
      ".food.wx-text",
      '[class*="dishName"]',
      '[class*="food wx-text"]',
    ].forEach((selector) => {
      doc.querySelectorAll(selector).forEach((element) => {
        const name = element.textContent.replace(/\s+/g, " ").trim();
        if (name) dishes.add(name);
      });
    });

    const avgPrice =
      doc.querySelector("div.price.wx-view")?.textContent.replace(/\s+/g, " ").trim() ||
      [...doc.querySelectorAll('[class*="price"]')]
        .map((element) => element.textContent.replace(/\s+/g, " ").trim())
        .find((text) => /[¥￥]\s*\d+.*人/.test(text)) ||
      "";

    const shopImage =
      doc.querySelector("img.shopPic[src]")?.getAttribute("src")?.trim() ||
      doc.querySelector('img[class*="shopPic"][src]')?.getAttribute("src")?.trim() ||
      "";
    const businessStatus =
      doc.querySelector(".biz-title .biz-txt")?.textContent.replace(/\s+/g, " ").trim() ||
      doc.querySelector(".biz-txt")?.textContent.replace(/\s+/g, " ").trim() ||
      "";
    const businessHours = uniqueTexts(doc.querySelectorAll(".biz-time")).join("、");
    const serviceFeatures = uniqueTexts(doc.querySelectorAll(".feature-txt"));
    const privateRoom = serviceFeatures.filter((text) => /包厢|包间/.test(text)).join("、");
    const otherServices = serviceFeatures
      .filter((text) => !/包厢|包间/.test(text))
      .join("、");

    return {
      category,
      region,
      dishes: [...dishes].slice(0, 50).join("、"),
      avgPrice,
      shopImage,
      businessStatus,
      businessHours,
      privateRoom,
      otherServices,
    };
  }

  function downloadCsv(rows, suffix) {
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `大众点评上海美食收藏_页面导航补全_${suffix}_${Date.now()}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function waitForDetailPage(worker, expectedShopId) {
    const startedAt = Date.now();
    let scrolled = false;

    while (Date.now() - startedAt < PAGE_TIMEOUT_MS) {
      if (worker.closed) return { error: "工作标签页已关闭", stop: true };
      try {
        const currentUrl = worker.location.href;
        const doc = worker.document;
        const bodyText = doc.body?.innerText || "";
        if (
          /403\s*Forbidden|访问被拒绝|请求异常|验证中心|spiderindefence/i.test(
            `${doc.title}\n${bodyText.slice(0, 2000)}\n${currentUrl}`,
          )
        ) {
          return { error: "详情页被拒绝或进入验证", stop: true };
        }

        const onExpectedPage = currentUrl.includes(`/shop/${expectedShopId}`);
        if (onExpectedPage && doc.readyState === "complete") {
          if (!scrolled) {
            scrolled = true;
            try {
              worker.scrollTo(0, Math.floor(doc.body.scrollHeight * 0.6));
              await sleep(1800);
              worker.scrollTo(0, doc.body.scrollHeight);
              await sleep(2200);
            } catch {}
          }

          const info = extractFromDocument(doc);
          if (info.category || info.region || info.dishes || info.avgPrice) {
            return { info };
          }
        }
      } catch {
        // 被重定向到其他域名时，opener 无法读取页面，通常是登录或验证页面。
        return { error: "页面跳转到了其他域名或阻止了页面读取", stop: true };
      }
      await sleep(1000);
    }
    return { error: "页面加载超时或未找到目标字段", stop: false };
  }

  async function process(inputRows) {
    const worker = window.open("about:blank", "dp_detail_worker");
    if (!worker) {
      alert("工作标签页被浏览器拦截。请允许 www.dianping.com 弹出式窗口后重试。");
      return;
    }

    const rows = inputRows.map((row) => [...row]);
    const originalWidth = rows[0].length;
    rows.slice(1).forEach((row) => {
      while (row.length < originalWidth) row.push("");
    });

    const categoryIndex = ensureColumn(rows, "餐厅种类", ["菜系"]);
    const regionIndex = ensureColumn(rows, "商圈", ["区域"]);
    const dishesIndex = ensureColumn(rows, "推荐菜");
    const avgPriceIndex = ensureColumn(rows, "人均价格");
    const shopImageIndex = ensureColumn(rows, "店铺图片");
    const businessStatusIndex = ensureColumn(rows, "营业状态");
    const businessHoursIndex = ensureColumn(rows, "营业时间");
    const privateRoomIndex = ensureColumn(rows, "包厢情况");
    const otherServicesIndex = ensureColumn(rows, "其他服务");
    const statusIndex = ensureColumn(rows, "抓取状态");
    const fetchedAtIndex = ensureColumn(rows, "抓取时间");
    const headers = rows[0];
    const urlIndex = headers.findIndex((header) => /大众点评链接|链接|url/i.test(header));
    const nameIndex = headers.findIndex((header) => header === "店名");
    if (urlIndex < 0) {
      worker.close();
      throw new Error("CSV 里没有找到店铺链接列");
    }

    const pending = [];
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      if (!String(rows[rowIndex][statusIndex] || "").startsWith("完成（详情v2")) {
        pending.push(rowIndex);
      }
    }
    const batch = pending.slice(0, BATCH_SIZE);
    if (batch.length === 0) {
      worker.close();
      downloadCsv(rows, "全部完成");
      console.log("所有行均已完成。");
      return;
    }

    let completed = 0;
    for (const rowIndex of batch) {
      const row = rows[rowIndex];
      const url = row[urlIndex];
      const shopId = url.match(/\/shop\/([A-Za-z0-9]+)/)?.[1];
      if (!shopId) {
        row[statusIndex] = "待处理（链接无店铺ID）";
        continue;
      }

      console.log(`[${completed + 1}/${batch.length}] 打开：${row[nameIndex] || shopId}`);
      worker.location.href = url;
      const result = await waitForDetailPage(worker, shopId);
      row[fetchedAtIndex] = new Date().toLocaleString("zh-CN", { hour12: false });

      if (result.error) {
        row[statusIndex] = `待重试（${result.error}）`;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, completed }));
        downloadCsv(rows, `中止_已完成${completed}家`);
        console.warn(`停止：${result.error}`);
        if (!worker.closed) worker.close();
        return;
      }

      const info = result.info;
      row[categoryIndex] = info.category || "";
      row[regionIndex] = info.region || "";
      row[dishesIndex] = info.dishes || "";
      row[avgPriceIndex] = info.avgPrice || "";
      row[shopImageIndex] = info.shopImage || "";
      row[businessStatusIndex] = info.businessStatus || "";
      row[businessHoursIndex] = info.businessHours || "";
      row[privateRoomIndex] = info.privateRoom || "";
      row[otherServicesIndex] = info.otherServices || "";
      row[statusIndex] = "完成（详情v2-页面导航）";
      completed += 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, completed }));
      console.log(
        `  → 种类：${info.category || "未识别"}，商圈：${info.region || "未识别"}，人均：${info.avgPrice || "未识别"}，营业：${info.businessStatus || "未识别"} ${info.businessHours || ""}，包厢：${info.privateRoom || "未识别"}`,
      );
      if (completed < batch.length) await sleep(BETWEEN_PAGES_MS);
    }

    if (!worker.closed) worker.close();
    downloadCsv(rows, `测试完成${completed}家`);
    console.log(`完成：本次通过真实页面导航处理 ${completed} 家。`);
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      console.error("CSV为空或解析失败。");
      return;
    }
    await process(rows);
  };
  input.click();
})();
