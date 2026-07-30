#!/usr/bin/env python3
"""第二轮精简与补全配置。"""
import json
from pathlib import Path

CONFIG = Path(__file__).resolve().parent / "address_enrich_config.json"
with open(CONFIG, "r", encoding="utf-8") as f:
    cfg = json.load(f)

# 1. 修正/补充 tag -> district
tag_district_add = {
    "进贤路": "黄浦区",
    "兴安路": "黄浦区",
    "南昌路": "黄浦区",
    "柳州路": "徐汇区",
    "威海路": "静安区",
    "育婴堂路": "静安区",
    "愚园东路": "静安区",
    "瑞平路": "徐汇区",
    "东体育会路": "虹口区",
    "北苏州路": "静安区",
    "江泳路": "浦东新区",
    "包头路": "杨浦区",
    "沪南公路": "浦东新区",
    "番禺路": "长宁区",
    "昭化东路": "长宁区",
    "镇宁路": "长宁区",
    "利西路": "长宁区",
    "中漕路": "徐汇区",
    "山海关路": "静安区",
    "康定路": "静安区",
    "泰兴路": "静安区",
    "石门一路": "静安区",
    "石门二路": "静安区",
    "昌平路": "静安区",
    "西康路": "静安区",
    "胶州路": "静安区",
    "余姚路": "静安区",
    "海防路": "静安区",
    "武定路": "静安区",
    "延平路": "静安区",
    "宣化路": "长宁区",
    "昭化路": "长宁区",
    "凯旋路": "长宁区",
    "遵义路": "长宁区",
    "紫云西路": "长宁区",
    "天山路": "长宁区",
    "水城路": "长宁区",
    "兴义路": "长宁区",
    "娄山关路": "长宁区",
    "古羊路": "长宁区",
    "安龙路": "长宁区",
    "虹梅路": "闵行区",
    "襄阳北路": "徐汇区",
    "南阳路": "静安区",
    "延庆路": "徐汇区",
    "桂林路": "徐汇区",
    "宝安路": "虹口区",
    "光复路": "静安区",
    "栖山路": "浦东新区",
    "新会路": "普陀区",
    "中山南二路": "徐汇区",
    "长宁路": "长宁区",
    "乌鲁木齐北路": "静安区"
}
cfg["tag_to_district"].update(tag_district_add)

# 2. 移除 虹桥路 的路名->行政区映射（跨区长路，容易误判）
cfg["road_to_district"].pop("虹桥路", None)

# 3. 把“三林镇”合并进“三林”，避免重复标签
for item in cfg["business_tags"]:
    if item["tag"] == "三林":
        if "三林镇" not in item["keywords"]:
            item["keywords"].append("三林镇")
    # 虹桥 标签里去掉“虹桥路”，避免港汇恒隆等被误标
    if item["tag"] == "虹桥":
        item["keywords"] = [k for k in item["keywords"] if k != "虹桥路"]

# 4. 删除独立的“三林镇”标签（已合并到三林）
cfg["business_tags"] = [item for item in cfg["business_tags"] if item["tag"] != "三林镇"]

# 5. 补充一些未覆盖的街道商圈关键词
extra = {
    "长乐路": ["长乐路"],  # 保留但不映射行政区，因为跨区
    "北苏州路": ["北苏州路"],
    "沪南公路": ["沪南公路"],
    "江泳路": ["江泳路"],
    "包头路": ["包头路"],
    "威海路": ["威海路"],
    "育婴堂路": ["育婴堂路"],
    "瑞宁路": ["瑞宁路"],
    "西环路": ["西环路"]
}
existing = {item["tag"]: item for item in cfg["business_tags"]}
for tag, kws in extra.items():
    if tag in existing:
        existing[tag]["keywords"] = list(set(existing[tag]["keywords"] + kws))
    else:
        existing[tag] = {"tag": tag, "keywords": kws}
        cfg["business_tags"].append(existing[tag])

with open(CONFIG, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)

print("配置第二轮更新完成")
