#!/usr/bin/env python3
"""第五轮：把剩余少量未识别地址补上。"""
import json
from pathlib import Path

CONFIG = Path(__file__).resolve().parent / "address_enrich_config.json"
with open(CONFIG, "r", encoding="utf-8") as f:
    cfg = json.load(f)

# 补充 road -> district
road_add = {
    "竹园路": "闵行区",
    "莫干山路": "普陀区",
    "愚园支路": "静安区",
    "虬江路": "静安区",
    "江场西路": "静安区",
    "银亭路": "闵行区",
    "叶家宅路": "普陀区",
    "广东路": "黄浦区",
    "中兴路": "静安区",
    "衡水路": "虹口区",
    "吴江路": "静安区",
    "湟普汇": "静安区",
    "祁连山南路": "普陀区",
    "茅台路": "长宁区",
    "金虹桥商场": "长宁区",
    "联航路": "闵行区",
    "必翔商台": "闵行区",
    "大洋千树": "普陀区",
    "天安千树": "普陀区",
    "缤琦广场": "闵行区",
    "世界贸易大厦": "黄浦区",
    "新疆伊宁远征餐厅": "长宁区"
}
cfg["road_to_district"].update(road_add)

# 补充商圈关键词与 tag->district
new_tags = {
    "莫干山路": ["莫干山路", "大洋千树", "天安千树"],
    "愚园支路": ["愚园支路"],
    "虬江路": ["虬江路"],
    "江场西路": ["江场西路"],
    "银亭路": ["银亭路"],
    "叶家宅路": ["叶家宅路"],
    "广东路": ["广东路"],
    "中兴路": ["中兴路"],
    "衡水路": ["衡水路"],
    "吴江路": ["吴江路", "湟普汇"],
    "祁连山南路": ["祁连山南路"],
    "茅台路": ["茅台路", "金虹桥商场"],
    "竹园路": ["竹园路", "必翔商台", "联航路"]
}
existing = {item["tag"]: item for item in cfg["business_tags"]}
for tag, kws in new_tags.items():
    if tag in existing:
        existing[tag]["keywords"] = list(set(existing[tag]["keywords"] + kws))
    else:
        existing[tag] = {"tag": tag, "keywords": kws}
        cfg["business_tags"].append(existing[tag])

tag_dist = {
    "莫干山路": "普陀区",
    "愚园支路": "静安区",
    "虬江路": "静安区",
    "江场西路": "静安区",
    "银亭路": "闵行区",
    "叶家宅路": "普陀区",
    "广东路": "黄浦区",
    "中兴路": "静安区",
    "衡水路": "虹口区",
    "吴江路": "静安区",
    "祁连山南路": "普陀区",
    "茅台路": "长宁区",
    "竹园路": "闵行区"
}
cfg["tag_to_district"].update(tag_dist)

with open(CONFIG, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)

print("配置第五轮更新完成")
