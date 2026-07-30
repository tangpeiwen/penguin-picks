/*
在已登录的大众点评收藏页面打开开发者工具 Console，粘贴并运行本文件内容。
脚本只读取“上海 + 美食”收藏页，自动翻页并下载 CSV，不会修改收藏。
*/
(async () => {
  const FAVOR_TAG = "s10_c1_t-1";
  const MAX_PAGES = 100;
  const DELAY_MS = 800;
  const rows = [];
  const seenShopIds = new Set();

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `/member/2729405034/wishlists?pg=${page}&favorTag=${FAVOR_TAG}`;
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`第 ${page} 页请求失败：HTTP ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [...doc.querySelectorAll(".pic-txt.favor-list li")];
    if (items.length === 0) break;

    let newRows = 0;
    for (const item of items) {
      const shopLink = item.querySelector("h6 a[href^='/shop/']");
      const addressNode = item.querySelector(".mode-tc.addres p");
      if (!shopLink || !addressNode) continue;

      const shopId = shopLink.getAttribute("href").split("/").pop();
      if (seenShopIds.has(shopId)) continue;
      seenShopIds.add(shopId);

      const city = addressNode.querySelector(".city")?.textContent
        .replace(/^\[|\]$/g, "")
        .trim();
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
      newRows += 1;
    }

    console.log(`第 ${page} 页：${items.length} 条，新增 ${newRows} 条`);
    if (items.length < 30 || newRows === 0) break;
    await sleep(DELAY_MS);
  }

  const headers = ["页码", "店名", "城市", "地址", "星级", "收藏时间", "店铺ID", "大众点评链接"];
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.page,
        row.name,
        row.city,
        row.address,
        row.rating,
        row.savedAt,
        row.shopId,
        row.url,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `大众点评上海美食收藏_${rows.length}家.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  console.log(`完成：共导出 ${rows.length} 家。`);
})();
