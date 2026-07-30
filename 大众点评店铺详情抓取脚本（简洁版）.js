/*
在已登录的大众点评页面（任意 dianping.com 页面）打开开发者工具 Console，粘贴运行。
本脚本会弹出一个文件选择框，读取你本地的 CSV（必须包含“大众点评链接”列），
逐条请求店铺详情页并提取：
  - 菜系（<span class="category wx-text">）
  - 区域/商圈（<span class="region wx-text">，支持多个，如“肇嘉浜路/中山医院”）
  - 推荐菜（<div class="dishName wx-view"> 与 <span class="food wx-text">）
最后下载 enriched CSV，新增三列：菜系、���域、推荐菜。

注意：
1. 必须在登录状态下运行，且当前浏览器没有被频繁风控，否则可能被重定向到验证中心。
2. 435 家店大约需要 5-8 分钟，请保持页面在前台。
3. 如果某条命中风控，脚本会跳过该条并继续。
*/

(function () {
  const DELAY_MS = 1500;
  const JITTER_MS = 1000;
  const MAX_DISHES = 20;
  const DISH_SEPARATOR = " | ";

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function randomJitter() {
    return Math.floor(Math.random() * JITTER_MS);
  }

  function csvCell(value) {
    const s = String(value ?? "").replace(/"/g, '""');
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
      '[class*="food"]',
    ];
    const dishes = new Set();
    for (const sel of dishSelectors) {
      doc.querySelectorAll(sel).forEach((el) => {
        const name = el.textContent.replace(/\s+/g, " ").trim();
        if (name) dishes.add(name);
      });
    }
    const dishesText = Array.from(dishes).slice(0, MAX_DISHES).join(DISH_SEPARATOR);

    if (!category) {
      const m = html.match(/<span[^>]*class=["'][^"']*category[^"']*["'][^>]*>([^<]+)/i);
      if (m) category = m[1].trim();
    }
    if (!region) {
      const m = html.match(/<span[^>]*class=["'][^"']*region[^"']*["'][^>]*>([^<]+)/i);
      if (m) region = m[1].trim().split(/\s*[/／、|]\s*/).filter(Boolean).join("、");
    }

    const isVerify = /验证中心|verify\.meituan\.com|spiderindefence/i.test(html + title);
    return { category, region, dishes: dishesText, isVerify, title };
  }

  async function fetchShop(url) {
    await sleep(DELAY_MS + randomJitter());

    try {
      const resp = await fetch(url, {
        credentials: "include",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://www.dianping.com/",
        },
      });

      if (!resp.ok) {
        return {
          category: "",
          region: "",
          dishes: "",
          skipped: true,
          error: `HTTP ${resp.status}`,
        };
      }

      const html = await resp.text();
      const info = extractFromHtml(html);
      if (info.isVerify) {
        return { ...info, skipped: true, error: "验证中心" };
      }
      return info;
    } catch (e) {
      return {
        category: "",
        region: "",
        dishes: "",
        error: e.message,
        skipped: true,
      };
    }
  }

  async function process(rows) {
    const data = rows.slice(1).map((row) => {
      const obj = {};
      rows[0].forEach((header, index) => {
        obj[header] = row[index] ?? "";
      });
      return obj;
    });

    const urlKey =
      data[0] && "大众点评链接" in data[0]
        ? "大众点评链接"
        : Object.keys(data[0]).find((k) => /链接|url|dianping/i.test(k));
    if (!urlKey) throw new Error("CSV 里没有找到店铺链接列");

    const headers = [...rows[0], "菜系", "区域", "推荐菜"];
    const outRows = [headers];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const url = row[urlKey];
      console.log(`[${i + 1}/${data.length}] ${row["店名"] || url}`);
      const info = await fetchShop(url);
      if (info.skipped) {
        console.log(`  → 跳过（${info.error || "验证中心"}）`);
      } else {
        const dishCount = info.dishes ? info.dishes.split(DISH_SEPARATOR).length : 0;
        const dishPreview = info.dishes
          ? info.dishes.split(DISH_SEPARATOR).slice(0, 3).join(DISH_SEPARATOR) +
            (dishCount > 3 ? " 等" : "")
          : "未识别";
        console.log(
          `  → 菜系：${info.category || "未识别"}，区域：${info.region || "未识别"}，推荐菜：${dishPreview}`,
        );
      }
      const newRow = [
        ...rows[i + 1],
        info.category || "",
        info.region || "",
        info.dishes || "",
      ];
      outRows.push(newRow);
      if (i < data.length - 1) await sleep(DELAY_MS + randomJitter());
    }

    const csv = outRows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `大众点评上海美食收藏_带菜系区域推荐菜_${Date.now()}.csv`;
    a.click();
    console.log("✅ 完成，已开始下载 enriched CSV");
  }

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
