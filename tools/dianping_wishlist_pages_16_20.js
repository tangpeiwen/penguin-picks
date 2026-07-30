/*
在已登录的 www.dianping.com 收藏页面 Console 中运行。
只检查上海美食收藏第 16–20 页，不访问店铺详情、不修改收藏。
即使中间页面为空或不足 30 条，也会继续检查到第 20 页。
*/
(async () => {
  const START_PAGE = 16;
  const END_PAGE = 20;
  const FAVOR_TAG = "s10_c1_t-1";
  const DELAY_MS = 4000;
  const rows = [];
  const pageStats = [];
  const seenShopIds = new Set();

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  for (let page = START_PAGE; page <= END_PAGE; page += 1) {
    const url = `/member/2729405034/wishlists?pg=${page}&favorTag=${FAVOR_TAG}`;
    const response = await fetch(url, { credentials: "include" });

    if (!response.ok) {
      pageStats.push({ page, status: response.status, rawItems: 0, extracted: 0 });
      console.warn(`第 ${page} 页：HTTP ${response.status}`);
      if (response.status === 403 || response.status === 429) {
        console.warn("遇到限流，停止后续请求。");
        break;
      }
      await sleep(DELAY_MS);
      continue;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [...doc.querySelectorAll(".pic-txt.favor-list li")];
    let extracted = 0;

    for (const item of items) {
      const shopLink = item.querySelector("h6 a[href^='/shop/']");
      const addressNode = item.querySelector(".mode-tc.addres p");
      if (!shopLink || !addressNode) continue;

      const shopId = shopLink.getAttribute("href").split("/").pop();
      if (!shopId || seenShopIds.has(shopId)) continue;
      seenShopIds.add(shopId);

      const city = addressNode.querySelector(".city")?.textContent
        .replace(/^\[|\]$/g, "")
        .trim() ?? "";
      const starClass = [...addressNode.querySelectorAll("span")].find((node) =>
        [...node.classList].some((name) => name.startsWith("irr-star")),
      )?.className;
      const ratingMatch = starClass?.match(/irr-star(\d+)/);
      const addressClone = addressNode.cloneNode(true);
      addressClone.querySelectorAll("span").forEach((node) => node.remove());

      rows.push({
        page,
        name: shopLink.textContent.trim(),
        city,
        address: addressClone.textContent.replace(/\s+/g, " ").trim(),
        rating: ratingMatch ? Number(ratingMatch[1]) / 10 : "",
        savedAt: item.querySelector(".time")?.textContent.trim() ?? "",
        shopId,
        url: new URL(shopLink.getAttribute("href"), location.origin).href,
      });
      extracted += 1;
    }

    pageStats.push({ page, status: response.status, rawItems: items.length, extracted });
    console.log(`第 ${page} 页：原始 ${items.length} 条，成功提取 ${extracted} 条`);
    if (page < END_PAGE) await sleep(DELAY_MS);
  }

  console.table(pageStats);
  const headers = ["页码", "店名", "城市", "地址", "星级", "收藏时间", "店铺ID", "大众点评链接"];
  const csvRows = [
    headers,
    ...rows.map((row) => [
      row.page,
      row.name,
      row.city,
      row.address,
      row.rating,
      row.savedAt,
      row.shopId,
      row.url,
    ]),
  ];
  const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `大众点评上海美食收藏_第16至20页_${rows.length}家.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  console.log(`完成：第16–20页共提取 ${rows.length} 家。`);
})();
