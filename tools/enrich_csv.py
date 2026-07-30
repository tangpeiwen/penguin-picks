#!/usr/bin/env python3
"""
基于规则为大众点评收藏 CSV 补全行政区与商圈标签。
规则配置文件：tools/address_enrich_config.json
输出：outputs/大众点评上海美食收藏_ enriched.csv
"""
import csv
import json
import os
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "大众点评上海美食收藏.csv"
CONFIG = ROOT / "tools" / "address_enrich_config.json"
OUTPUT = ROOT / "outputs" / "大众点评上海美食收藏_带地区商圈.csv"


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
    # 1. 地址里直接出现“xx区”
    for d in cfg["districts"]:
        if d in address:
            return d

    # 2. 街道/镇/乡 前缀映射
    m = re.match(r"^([^，,（(]+?(?:街道|镇|乡))", address)
    if m:
        token = m.group(1)
        # 精确匹配
        if token in cfg["street_to_district"]:
            return cfg["street_to_district"][token]
        # 模糊：去掉“街道/镇/乡”再查
        base = token.replace("街道", "").replace("镇", "").replace("乡", "")
        if base in cfg["street_to_district"]:
            return cfg["street_to_district"][base]

    # 3. 关键路名/商圈映射（按长度优先，避免短词误命中）
    roads = sorted(cfg["road_to_district"].items(), key=lambda x: -len(x[0]))
    for road, district in roads:
        if road in address:
            return district

    return ""


def district_from_tags(tags, cfg):
    """如果行政区仍为空，用已识别商圈反推一个最可能行政区。"""
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
    # 长关键词优先，避免短词覆盖
    entries.sort(key=lambda x: -len(x[0]))
    for kw, tag in entries:
        if kw in address:
            tags.add(tag)
    return sorted(tags)


def main():
    cfg = load_config()
    enc = detect_encoding(INPUT)
    print(f"检测到文件编码: {enc}")

    rows = []
    with open(INPUT, "r", encoding=enc, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        for row in reader:
            address = row.get("地址", "")
            district = extract_district(address, cfg)
            tags = extract_business_tags(address, cfg)
            if not district and tags:
                district = district_from_tags(tags, cfg)
            row["行政区"] = district
            row["商圈标签"] = "、".join(tags)
            row["商圈数量"] = str(len(tags))
            rows.append(row)

    new_fields = fieldnames + ["行政区", "商圈标签", "商圈数量"]
    os.makedirs(OUTPUT.parent, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=new_fields)
        writer.writeheader()
        writer.writerows(rows)

    # 简单统计
    district_counts = Counter(r["行政区"] for r in rows if r["行政区"])
    tag_counts = Counter()
    for r in rows:
        for t in r["商圈标签"].split("、"):
            if t:
                tag_counts[t] += 1

    unmatched = [r for r in rows if not r["行政区"]]

    print(f"处理完成：共 {len(rows)} 行，输出到 {OUTPUT}")
    print("\n行政区分布：")
    for d, c in district_counts.most_common():
        print(f"  {d}: {c}")
    print(f"\n未识别行政区：{len(unmatched)} 行")
    print("\nTop 20 商圈标签：")
    for tag, c in tag_counts.most_common(20):
        print(f"  {tag}: {c}")

    # 把未识别的前 20 条写个小片段方便补规则
    if unmatched:
        print("\n部分未识别地址（前 20）：")
        for r in unmatched[:20]:
            print(f"  - {r['店名']}: {r['地址']}")


if __name__ == "__main__":
    main()
