import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const sourcePath =
  "/Users/aaaa/.codex/attachments/bdf08673-e7e4-4a72-a803-c03eef742e78/pasted-text.txt";
const outputDir = path.resolve("outputs/dianping_wishlist");

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function cleanText(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function parseWishlist(html, page) {
  const rows = [];
  const itemPattern = /<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/g;

  for (const match of html.matchAll(itemPattern)) {
    const item = match[1];
    const shop = item.match(
      /<h6>\s*<a\s+href="(\/shop\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h6>/,
    );
    const addressBlock = item.match(
      /<div class="mode-tc addres">[\s\S]*?<p>([\s\S]*?)<\/p>/,
    );
    if (!shop || !addressBlock) continue;

    const cityMatch = addressBlock[1].match(
      /<span class="city">\[([^\]]+)\]<\/span>/,
    );
    const starMatch = addressBlock[1].match(/\birr-star(\d+)\b/);
    const timeMatch = item.match(/<i class="time">([^<]+)<\/i>/);
    const address = cleanText(
      addressBlock[1]
        .replace(/<span class="city">[\s\S]*?<\/span>/, "")
        .replace(/<span[^>]*class="[^"]*item-rank-rst[^"]*"[^>]*><\/span>/, ""),
    );

    rows.push({
      page,
      name: cleanText(shop[2]),
      city: cityMatch ? cleanText(cityMatch[1]) : "",
      address,
      rating: starMatch ? Number(starMatch[1]) / 10 : null,
      savedAt: timeMatch ? cleanText(timeMatch[1]) : "",
      shopId: shop[1].split("/").pop(),
      url: `https://www.dianping.com${shop[1]}`,
    });
  }
  return rows;
}

const html = await fs.readFile(sourcePath, "utf8");
const rows = parseWishlist(html, 2);
if (rows.length === 0) throw new Error("No wishlist entries were parsed.");

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("上海美食收藏");
sheet.showGridLines = false;
sheet.freezePanes.freezeRows(1);

const headers = [
  "页码",
  "店名",
  "城市",
  "地址",
  "星级",
  "收藏时间",
  "店铺ID",
  "大众点评链接",
];
const values = rows.map((row) => [
  row.page,
  row.name,
  row.city,
  row.address,
  row.rating,
  row.savedAt ? new Date(`${row.savedAt.replace(" ", "T")}:00+08:00`) : null,
  row.shopId,
  row.url,
]);

sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
sheet.getRangeByIndexes(1, 0, values.length, headers.length).values = values;

const used = sheet.getRangeByIndexes(0, 0, values.length + 1, headers.length);
used.format.font = { name: "Aptos", size: 10 };
used.format.verticalAlignment = "center";

const headerRange = sheet.getRange("A1:H1");
headerRange.format = {
  fill: "#1F4E78",
  font: { bold: true, color: "#FFFFFF", size: 11 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  rowHeight: 26,
  borders: { preset: "outside", style: "thin", color: "#163A5A" },
};

sheet.getRange(`A2:A${rows.length + 1}`).format.horizontalAlignment = "center";
sheet.getRange(`C2:C${rows.length + 1}`).format.horizontalAlignment = "center";
sheet.getRange(`E2:E${rows.length + 1}`).format = {
  horizontalAlignment: "center",
  numberFormat: "0.0",
};
sheet.getRange(`F2:F${rows.length + 1}`).format = {
  horizontalAlignment: "center",
  numberFormat: "yyyy-mm-dd hh:mm",
};
sheet.getRange(`D2:D${rows.length + 1}`).format.wrapText = true;
sheet.getRange(`H2:H${rows.length + 1}`).format.font = { color: "#0563C1" };

sheet.getRange("A:A").format.columnWidth = 8;
sheet.getRange("B:B").format.columnWidth = 28;
sheet.getRange("C:C").format.columnWidth = 10;
sheet.getRange("D:D").format.columnWidth = 58;
sheet.getRange("E:E").format.columnWidth = 9;
sheet.getRange("F:F").format.columnWidth = 20;
sheet.getRange("G:G").format.columnWidth = 22;
sheet.getRange("H:H").format.columnWidth = 45;
sheet.getRange(`A2:H${rows.length + 1}`).format.rowHeight = 30;

sheet.tables.add(`A1:H${rows.length + 1}`, true, "DianpingWishlist");

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "上海美食收藏",
  range: "A1:H12",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(path.join(outputDir, "大众点评上海美食收藏_第2页.xlsx"));

const inspected = await workbook.inspect({
  kind: "table",
  range: `上海美食收藏!A1:H${Math.min(rows.length + 1, 8)}`,
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 8,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(
  JSON.stringify({
    count: rows.length,
    inspect: inspected.ndjson,
    errors: errors.ndjson,
  }),
);
