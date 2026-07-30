#!/usr/bin/env python3
"""基于已识别的行政区/商圈，生成带完整字段的录入模板。"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "outputs" / "大众点评上海美食收藏_带地区商圈.csv"
OUT = ROOT / "outputs" / "餐厅数据录入模板.csv"

extra_fields = [
    "菜系",
    "人均",
    "订位难度",
    "场合标签",
    "适配人数",
    "我的短评",
    "必点菜1",
    "必点菜1一句话",
    "必点菜2",
    "必点菜2一句话",
    "必点菜3",
    "必点菜3一句话",
    "避雷项",
    "经度",
    "纬度",
]

with open(SRC, "r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    fieldnames = reader.fieldnames or []

# 保留原始字段，并把行政区/商圈提前到方便查看的位置
preferred = ["店名", "行政区", "商圈标签", "商圈数量", "地址", "星级", "收藏时间", "大众点评链接", "店铺ID", "城市", "页码"]
remaining = [f for f in fieldnames if f not in preferred]
new_fieldnames = preferred + remaining + extra_fields

with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=new_fieldnames)
    writer.writeheader()
    for row in rows:
        for ef in extra_fields:
            row.setdefault(ef, "")
        writer.writerow(row)

print(f"模板已生成：{OUT}，共 {len(rows)} 行，{len(new_fieldnames)} 列")
