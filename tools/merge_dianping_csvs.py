#!/usr/bin/env python3
"""
按“大众点评1.csv”的表头合并两个 CSV。
第二个 CSV 中语义对应的列会映射过来，其余列按大众点评1表头留空。
用法：
  python3 tools/merge_dianping_csvs.py
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT1 = Path("/Users/aaaa/Downloads/大众点评1.csv")
INPUT2 = Path("/Users/aaaa/Downloads/大众点评上海美食收藏_剩余116家.csv")
OUTPUT = ROOT / "outputs" / "大众点评_合并.csv"

# 大众点评1 的表头
MASTER_HEADER = [
    "页码", "店名", "菜系", "人均", "营业时间", "点菜", "避雷",
    "场合", "人数", "订位", "评价", "城市", "地址", "星级",
    "收藏时间", "店铺ID", "大众点评链接", "行政区", "商圈标签",
]

# 第二个 CSV 列名 → 大众点评1 列名 的映射
COLUMN_MAP = {
    "餐厅种类": "菜系",
    "人均价格": "人均",
    "商圈": "商圈标签",
}


def detect_encoding(path):
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb2312"):
        try:
            with open(path, "r", encoding=enc) as f:
                f.read(1024)
            return enc
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "utf-8"


def read_rows(path):
    enc = detect_encoding(path)
    with open(path, "r", encoding=enc, newline="") as f:
        reader = csv.DictReader(f)
        return list(reader)


def normalize_row(row, source_map):
    """把原始行转换为 MASTER_HEADER 格式。"""
    out = {}
    for master_col in MASTER_HEADER:
        out[master_col] = ""

    for raw_col, value in row.items():
        if not raw_col:
            continue
        target_col = source_map.get(raw_col, raw_col)
        if target_col in out:
            # 把纯空白/换行内容视为空
            cleaned = (value or "").strip().replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
            out[target_col] = cleaned
    return out


def main():
    rows1 = read_rows(INPUT1)
    rows2 = read_rows(INPUT2)

    merged = []
    for row in rows1:
        merged.append(normalize_row(row, {}))
    for row in rows2:
        merged.append(normalize_row(row, COLUMN_MAP))

    # 统计重复店铺（按大众点评链接）
    seen = {}
    duplicates = []
    for i, row in enumerate(merged):
        url = row.get("大众点评链接", "")
        if url:
            if url in seen:
                duplicates.append((seen[url], i))
            else:
                seen[url] = i

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=MASTER_HEADER)
        writer.writeheader()
        writer.writerows(merged)

    print(f"合并完成：")
    print(f"  - 大众点评1.csv：{len(rows1)} 行")
    print(f"  - 大众点评上海美食收藏_剩余116家.csv：{len(rows2)} 行")
    print(f"  - 合并后总计：{len(merged)} 行")
    print(f"  - 输出：{OUTPUT}")
    if duplicates:
        print(f"\n注意：发现 {len(duplicates)} 条重复店铺（按大众点评链接）：")
        for idx1, idx2 in duplicates[:10]:
            print(f"  - 第 {idx1 + 2} 行 与 第 {idx2 + 2} 行：{merged[idx1]['店名']} / {merged[idx2]['店名']}")


if __name__ == "__main__":
    main()
