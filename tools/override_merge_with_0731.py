#!/usr/bin/env python3
"""
用“大众点评0731.csv”覆盖“大众点评_合并_带经纬度.csv”中相同店面的记录，
但保留合并文件中的经纬度和地理编码状态。

用法：
  python3 tools/override_merge_with_0731.py
"""
import csv
from pathlib import Path

TARGET_PATH = Path("/Users/aaaa/Documents/GitHub/餐厅/大众点评_合并_带经纬度.csv")
SOURCE_PATH = Path("/Users/aaaa/Downloads/大众点评0731.csv")
OUTPUT_PATH = Path("/Users/aaaa/Documents/GitHub/餐厅/outputs/大众点评_合并_带经纬度_0731覆盖.csv")


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
        return reader.fieldnames or [], list(reader)


def normalize_url(url):
    return url.strip().lower().rstrip("/")


def build_index(rows):
    """按 大众点评链接、店铺ID、(店名,地址) 建立索引。"""
    by_url = {}
    by_shop_id = {}
    by_name_addr = {}

    for r in rows:
        url = normalize_url(r.get("大众点评链接", ""))
        shop_id = r.get("店铺ID", "").strip()
        name = r.get("店名", "").strip()
        addr = r.get("地址", "").strip()

        if url:
            by_url[url] = r
        if shop_id:
            by_shop_id[shop_id] = r
        if name and addr:
            by_name_addr[(name, addr)] = r

    return by_url, by_shop_id, by_name_addr


def find_match(row, by_url, by_shop_id, by_name_addr):
    url = normalize_url(row.get("大众点评链接", ""))
    if url and url in by_url:
        return by_url[url]

    shop_id = row.get("店铺ID", "").strip()
    if shop_id and shop_id in by_shop_id:
        return by_shop_id[shop_id]

    name = row.get("店名", "").strip()
    addr = row.get("地址", "").strip()
    if name and addr and (name, addr) in by_name_addr:
        return by_name_addr[(name, addr)]

    return None


def main():
    target_header, target_rows = read_rows(TARGET_PATH)
    _, source_rows = read_rows(SOURCE_PATH)

    by_url, by_shop_id, by_name_addr = build_index(source_rows)

    # 要保留的合并文件专属列
    merge_only_cols = [c for c in target_header if c not in (
        "页码", "店名", "菜系", "人均", "营业时间", "点菜", "避雷",
        "场合", "人数", "订位", "评价", "城市", "地址", "星级",
        "收藏时间", "店铺ID", "大众点评链接", "行政区", "商圈标签"
    )]

    out_rows = []
    overridden = 0
    unchanged = 0

    for r in target_rows:
        match = find_match(r, by_url, by_shop_id, by_name_addr)
        if match:
            # 用 0731 的记录覆盖
            new_row = dict(match)
            # 保留合并文件中的专属列（经纬度、地理编码状态）
            for col in merge_only_cols:
                new_row[col] = r.get(col, "")
            out_rows.append(new_row)
            overridden += 1
        else:
            out_rows.append(r)
            unchanged += 1

    # 补齐列
    for r in out_rows:
        for col in target_header:
            if col not in r:
                r[col] = ""

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=target_header)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"完成：")
    print(f"  - 合并文件原行数：{len(target_rows)}")
    print(f"  - 被 0731 覆盖：{overridden} 行")
    print(f"  - 未匹配保持不变：{unchanged} 行")
    print(f"  - 输出：{OUTPUT_PATH}")


if __name__ == "__main__":
    main()
