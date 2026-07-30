#!/usr/bin/env python3
"""第四轮：清理商圈误命中、补充剩余路名。"""
import json
from pathlib import Path

CONFIG = Path(__file__).resolve().parent / "address_enrich_config.json"
with open(CONFIG, "r", encoding="utf-8") as f:
    cfg = json.load(f)

# 1. 清理误命中：人民广场不应该因为“南京西路/南京东路”被触发
for item in cfg["business_tags"]:
    if item["tag"] == "人民广场":
        item["keywords"] = [k for k in item["keywords"] if k not in ("南京西路", "南京东路")]
    # 徐家汇也不应因为“天钥桥路/漕溪北路”被触发？这两条确实在徐家汇商圈，保留

# 2. 新增商圈与关键词
new_tags = {
    "襄阳南路": ["襄阳南路"],
    "龙漕路": ["龙漕路"],
    "大沽路": ["大沽路"],
    "天目中路": ["天目中路"],
    "长阳路": ["长阳路"],
    "宋园路": ["宋园路"],
    "吴中路": ["吴中路"],
    "海宁路": ["海宁路"],
    "金沙江路": ["金沙江路"],
    "瑞宁路": ["瑞宁路"],
    "龙文路": ["龙文路"],
    "芋秋路": ["芋秋路"],
    "汇臻路": ["汇臻路"],
    "西环路": ["西环路"],
    "五角场": ["五角场", "合生汇", "大学路", "江湾体育场"]
}
existing = {item["tag"]: item for item in cfg["business_tags"]}
for tag, kws in new_tags.items():
    if tag in existing:
        existing[tag]["keywords"] = list(set(existing[tag]["keywords"] + kws))
    else:
        existing[tag] = {"tag": tag, "keywords": kws}
        cfg["business_tags"].append(existing[tag])

# 3. 补充 tag -> district
tag_dist = {
    "襄阳南路": "徐汇区",
    "龙漕路": "徐汇区",
    "大沽路": "静安区",
    "天目中路": "静安区",
    "长阳路": "杨浦区",
    "宋园路": "长宁区",
    "吴中路": "闵行区",
    "海宁路": "静安区",
    "金沙江路": "普陀区",
    "瑞宁路": "徐汇区",
    "龙文路": "浦东新区",
    "芋秋路": "浦东新区",
    "汇臻路": "闵行区",
    "西环路": "松江区",
    "五角场": "杨浦区"
}
cfg["tag_to_district"].update(tag_dist)

# 4. 补充 road -> district（兜底）
road_add = {
    "襄阳南路": "徐汇区",
    "龙漕路": "徐汇区",
    "大沽路": "静安区",
    "天目中路": "静安区",
    "天目西路": "静安区",
    "长阳路": "杨浦区",
    "宋园路": "长宁区",
    "吴中路": "闵行区",
    "海宁路": "静安区",
    "金沙江路": "普陀区",
    "瑞宁路": "徐汇区",
    "龙文路": "浦东新区",
    "芋秋路": "浦东新区",
    "汇臻路": "闵行区",
    "西环路": "松江区",
    "园照路": "徐汇区",
    "龙阳路": "浦东新区",
    "涵合园": "浦东新区",
    "燎申大厦": "闵行区",
    "长阳美食工坊": "杨浦区",
    "乐汇广场": "闵行区",
    "森林湾大厦": "静安区",
    "新嘉中心": "浦东新区",
    "788广场": "普陀区"
}
cfg["road_to_district"].update(road_add)

with open(CONFIG, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)

print("配置第四轮更新完成")
