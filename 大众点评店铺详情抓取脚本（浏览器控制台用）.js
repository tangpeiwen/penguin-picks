/*
在已登录的大众点评页面（任意 dianping.com 页面）打开开发者工具 Console，粘贴运行。
本脚本会弹出一个文件选择框，读取你本地的 CSV（必须包含“大众点评链接”列），
逐条请求店铺详情页并提取：
  - 餐厅种类（<span class="category wx-text">）
  - 商圈（<span class="region wx-text">，支持多个）
  - 推荐菜（<div class="dishName wx-view"> 与 <span class="food wx-text">）
  - 人均价格（<div class="price wx-view">）
最后下载 enriched CSV。

特性：
1. 新登录会话默认先测试 5 家；确认稳定后再逐步调整 BATCH_SIZE。
2. 每次请求间隔约 8–13 秒；首次遇到 403/429 就停止，不继续冲击限流。
3. 阶段 CSV 包含“抓取状态”；下次选择最新 CSV，会自动从未完成行继续。
4. 当前批次进度另存 localStorage（key: dp_extract_state_v2），防止意外刷新。

注意：
- 每批结束后，请下一次选择刚下载的最新 CSV。
- 遇到 403/429 后建议暂停一段时间再继续，不要马上重复运行。
*/

(function () {
  const BATCH_SIZE = 5;
  const DELAY_MS = 8000;
  const JITTER_MS = 5000;
  const STORAGE_KEY = "dp_extract_state_v2";

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function randomJitter() {
    return Math.floor(Math.random() * JITTER_MS);
  }

  function csvCell(value) {
    const s = String(value ?? "").replaceAll('"', '""');
    return `"${s}"`;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          cell += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ",") {
          row.push(cell);
          cell = "";
        } else if (c === "\n" || c === "\r") {
          if (cell !== "" || row.length > 0) {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
          }
          if (c === "\r" && next === "\n") i++;
        } else {
          cell += c;
        }
      }
    }
    if (cell !== "" || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
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

  function extractFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = doc.title || "";

    const avgPrice =
      doc.querySelector("div.price.wx-view")?.textContent.replace(/\s+/g, " ").trim() ||
      [...doc.querySelectorAll('[class*="price"]')]
        .map((element) => element.textContent.replace(/\s+/g, " ").trim())
        .find((text) => /[¥￥]\s*\d+.*人/.test(text)) ||
      "";

    const categoryNodes = doc.querySelectorAll("span.category.wx-text");
    const regionNodes = doc.querySelectorAll("span.region.wx-text");
    let category = uniqueTexts(categoryNodes).join("、");
    let region = uniqueTexts(regionNodes, true).join("、");

    if (!category) {
      category = uniqueTexts(doc.querySelectorAll('[class*="category"]')).join("、");
    }
    if (!region) {
      region = uniqueTexts(doc.querySelectorAll('[class*="region"]'), true).join("、");
    }

    const dishSelectors = [
      ".dishName.wx-view",
      ".food.wx-text",
      '[class*="dishName"]',
      '[class*="food wx-text"]',
    ];
    const dishes = new Set();
    for (const sel of dishSelectors) {
      doc.querySelectorAll(sel).forEach((el) => {
        const name = el.textContent.replace(/\s+/g, " ").trim();
        if (name) dishes.add(name);
      });
    }
    const dishesText = [...dishes].slice(0, 50).join("、");

    if (!category) {
      const m = html.match(/<span[^>]*class=["'][^"']*category[^"']*["'][^>]*>([^<]+)/i);
      if (m) category = m[1].trim();
    }
    if (!region) {
      const m = html.match(/<span[^>]*class=["'][^"']*region[^"']*["'][^>]*>([^<]+)/i);
      if (m) region = m[1].trim().split(/\s*[/／、|]\s*/).filter(Boolean).join("、");
    }

    const isVerify = /验证中心|verify\.meituan\.com|spiderindefence/i.test(html + title);
    return { category, region, dishes: dishesText, avgPrice, isVerify, title };
  }

  async function fetchOnce(url) {
    const resp = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://www.dianping.com/",
      },
    });

    if (!resp.ok) {
      const html = await resp.text().catch(() => "");
      return { html, status: resp.status, ok: false };
    }
    const html = await resp.text();
    return { html, status: 200, ok: true };
  }

  async function fetchShop(url) {
    await sleep(DELAY_MS + randomJitter());

    try {
      const result = await fetchOnce(url);

      if (!result.ok) {
        return {
          category: "",
          region: "",
          dishes: "",
          avgPrice: "",
          skipped: true,
          rateLimited: result.status === 403 || result.status === 429,
          error: `HTTP ${result.status}`,
        };
      }

      const info = extractFromHtml(result.html);
      if (info.isVerify) {
        return { ...info, skipped: true, rateLimited: true, error: "验证中心" };
      }
      return info;
    } catch (e) {
      return {
        category: "",
        region: "",
        dishes: "",
        avgPrice: "",
        error: e.message,
        skipped: true,
      };
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function triggerDownload(rows, suffix) {
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `大众点评上海美食收藏_详情抓取_${suffix}_${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    console.log(`💾 已下载阶段 CSV：${suffix}`);
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

  async function process(inputRows) {
    let outRows = inputRows.map((row) => [...row]);
    const originalWidth = outRows[0].length;
    outRows.slice(1).forEach((row) => {
      while (row.length < originalWidth) row.push("");
    });

    const categoryIndex = ensureColumn(outRows, "餐厅种类", ["菜系"]);
    const regionIndex = ensureColumn(outRows, "商圈", ["区域"]);
    const dishesIndex = ensureColumn(outRows, "推荐菜");
    const avgPriceIndex = ensureColumn(outRows, "人均价格");
    const statusIndex = ensureColumn(outRows, "抓取状态");
    const fetchedAtIndex = ensureColumn(outRows, "抓取时间");
    const headers = outRows[0];
    const urlIndex = headers.findIndex((header) => /大众点评链接|链接|url/i.test(header));
    const nameIndex = headers.findIndex((header) => header === "店名");
    if (urlIndex < 0) throw new Error("CSV 里没有找到店铺链接列");

    const sourceKey = [
      outRows.length,
      outRows[1]?.[urlIndex] || "",
      outRows[outRows.length - 1]?.[urlIndex] || "",
    ].join("|");
    let state = loadState();
    if (state?.sourceKey === sourceKey && Array.isArray(state.outRows)) {
      const resume = confirm(
        `检测到浏览器内保存的进度：已尝试 ${state.attempted || 0} 家。确定继续；取消则以当前选择的 CSV 为准。`,
      );
      if (resume) {
        outRows = state.outRows;
        console.log("已恢复浏览器内保存的阶段数据。");
      } else {
        clearState();
        state = null;
      }
    } else if (state) {
      clearState();
      state = null;
    }

    outRows.slice(1).forEach((row) => {
      if (
        !row[statusIndex] &&
        (row[categoryIndex] || row[regionIndex] || row[dishesIndex] || row[avgPriceIndex])
      ) {
        row[statusIndex] = "完成（旧版已有数据）";
      }
    });

    const pendingIndexes = [];
    for (let rowIndex = 1; rowIndex < outRows.length; rowIndex++) {
      if (!String(outRows[rowIndex][statusIndex] || "").startsWith("完成")) {
        pendingIndexes.push(rowIndex);
      }
    }
    if (pendingIndexes.length === 0) {
      clearState();
      triggerDownload(outRows, "全部完成");
      console.log("✅ 所有店铺均已有抓取结果。");
      return;
    }

    const batchIndexes = pendingIndexes.slice(0, BATCH_SIZE);
    let attempted = 0;
    console.log(
      `本批计划处理 ${batchIndexes.length} 家；当前仍有 ${pendingIndexes.length} 家待处理。`,
    );

    for (const rowIndex of batchIndexes) {
      const row = outRows[rowIndex];
      const url = row[urlIndex];
      console.log(
        `[本批 ${attempted + 1}/${batchIndexes.length}｜总表第 ${rowIndex}/${outRows.length - 1} 行] ${row[nameIndex] || url}`,
      );
      const info = await fetchShop(url);

      if (info.rateLimited) {
        row[statusIndex] = `待重试（${info.error || "限流"}）`;
        row[fetchedAtIndex] = new Date().toLocaleString("zh-CN", { hour12: false });
        state = { sourceKey, outRows, attempted };
        saveState(state);
        triggerDownload(outRows, `遇限流_已尝试${attempted}家`);
        console.warn(
          `⛔ 遇到 ${info.error || "限流"}，本批立即停止。请稍后重新运行并选择刚下载的 CSV。`,
        );
        return;
      }

      if (info.skipped) {
        console.log(`  → 跳过（${info.error || "未知错误"}）`);
        row[statusIndex] = `待重试（${info.error || "未知错误"}）`;
      } else {
        const dishPreview = info.dishes
          ? info.dishes.split("、").slice(0, 3).join("、") + " 等"
          : "未识别";
        console.log(
          `  → 种类：${info.category || "未识别"}，商圈：${info.region || "未识别"}，人均：${info.avgPrice || "未识别"}，推荐菜：${dishPreview}`,
        );
        row[categoryIndex] = info.category || "";
        row[regionIndex] = info.region || "";
        row[dishesIndex] = info.dishes || "";
        row[avgPriceIndex] = info.avgPrice || "";
        row[statusIndex] = "完成";
      }
      row[fetchedAtIndex] = new Date().toLocaleString("zh-CN", { hour12: false });
      attempted += 1;
      state = { sourceKey, outRows, attempted };
      saveState(state);
    }

    const remaining = outRows
      .slice(1)
      .filter((row) => !String(row[statusIndex] || "").startsWith("完成")).length;
    if (remaining === 0) clearState();
    triggerDownload(
      outRows,
      remaining === 0 ? "全部完成" : `本批完成${attempted}家_剩余${remaining}家`,
    );
    console.log(
      remaining === 0
        ? "✅ 全部完成。"
        : `✅ 本批完成 ${attempted} 家，剩余 ${remaining} 家。稍后可重新运行并选择刚下载的 CSV。`,
    );
  }

  window.dpExtractDownloadPartial = function () {
    const s = loadState();
    if (!s) {
      console.log("没有可导出的进度");
      return;
    }
    triggerDownload(s.outRows, `手动备份_已尝试${s.attempted || 0}家`);
  };

  function start() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        console.error("CSV 为空或解析失败");
        return;
      }
      console.log(`读取到 ${rows.length - 1} 行，开始抓取...`);
      await process(rows);
    };
    input.click();
  }

  start();
})();
