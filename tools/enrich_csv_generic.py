#!/usr/bin/env python3
"""
通用版：为大众点评收藏 CSV 补全行政区与商圈标签。
用法示例：
  python3 tools/enrich_csv_generic.py \
    --input "/Users/aaaa/Downloads/大众点评上海美食收藏_第16至20页_121家.csv" \
    --output "/Users/aaaa/Documents/GitHub/餐厅/outputs/大众点评上海美食收藏_第16至20页_121家_带地区商圈.csv"

输出表头固定为：
  页码,店名,评价,城市,地址,星级,收藏时间,店铺ID,大众点评链接,行政区,商圈标签
"""
import argparse
import csv
import json
import os
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "tools" / "address_enrich_config.json"

OUTPUT_HEADER = [
    "页码",
    "店名",
    "评价",
    "城市",
    "地址",
    "星级",
    "收藏时间",
    "店铺ID",
    "大众点评链接",
    "行政区",
    "商圈标签",
]


def load_config():
    with open(CONFIG, "r", encoding="utf-8") as f:
        return json.load(f)


def detect_encoding(path):
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb2312"):
        try:
            with open(path, "r", encoding=enc) as f:
                f.read(1024)
            return enc
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "utf-8"


def extract_district(address, cfg):
    for d in cfg["districts"]:
        if d in address:
            return d

    m = re.match(r"^([^，,（(]+?(?:街道|镇|乡))", address)
    if m:
        token = m.group(1)
        if token in cfg["street_to_district"]:
            return cfg["street_to_district"][token]
        base = token.replace("街道", "").replace("镇", "").replace("乡", "")
        if base in cfg["street_to_district"]:
            return cfg["street_to_district"][base]

    roads = sorted(cfg["road_to_district"].items(), key=lambda x: -len(x[0]))
    for road, district in roads:
        if road in address:
            return district

    return ""


def district_from_tags(tags, cfg):
    mapping = cfg.get("tag_to_district", {})
    for tag in tags:
        if tag in mapping:
            return mapping[tag]
    return ""


def extract_business_tags(address, cfg):
    tags = set()
    entries = []
    for item in cfg["business_tags"]:
        tag = item["tag"]
        for kw in item["keywords"]:
            entries.append((kw, tag))
    entries.sort(key=lambda x: -len(x[0]))
    for kw, tag in entries:
        if kw in address:
            tags.add(tag)
    return sorted(tags)


def main():
    parser = argparse.ArgumentParser(description="为大众点评收藏 CSV 补全行政区与商圈标签")
    parser.add_argument("--input", "-i", required=True, help="输入 CSV 路径")
    parser.add_argument("--output", "-o", required=True, help="输出 CSV 路径")
    args = parser.parse_args()

    cfg = load_config()
    enc = detect_encoding(args.input)
    print(f"检测到文件编码: {enc}")

    rows = []
    with open(args.input, "r", encoding=enc, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            address = row.get("地址", "")
            district = extract_district(address, cfg)
            tags = extract_business_tags(address, cfg)
            if not district and tags:
                district = district_from_tags(tags, cfg)

            out_row = {}
            for h in OUTPUT_HEADER:
                if h == "行政区":
                    out_row[h] = district
                elif h == "商圈标签":
                    out_row[h] = "、".join(tags)
                elif h == "评价":
                    out_row[h] = row.get("评价", "")
                else:
                    out_row[h] = row.get(h, "")
            rows.append(out_row)

    os.makedirs(Path(args.output).parent, exist_ok=True)
    with open(args.output, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_HEADER)
        writer.writeheader()
        writer.writerows(rows)

    district_counts = Counter(r["行政区"] for r in rows if r["行政区"])
    tag_counts = Counter()
    for r in rows:
        for t in r["商圈标签"].split("、"):
            if t:
                tag_counts[t] += 1

    unmatched = [r for r in rows if not r["行政区"]]

    print(f"处理完成：共 {len(rows)} 行，输出到 {args.output}")
    print("\n行政区分布：")
    for d, c in district_counts.most_common():
        print(f"  {d}: {c}")
    print(f"\n未识别行政区：{len(unmatched)} 行")
    print("\nTop 20 商圈标签：")
    for tag, c in tag_counts.most_common(20):
        print(f"  {tag}: {c}")

    if unmatched:
        print("\n部分未识别地址（前 20）：")
        for r in unmatched[:20]:
            print(f"  - {r['店名']}: {r['地址']}")


if __name__ == "__main__":
    main()
