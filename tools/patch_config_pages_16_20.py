#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "tools" / "address_enrich_config.json"

with open(CONFIG, "r", encoding="utf-8") as f:
    cfg = json.load(f)

additions = {
    "延安东路": "黄浦区",
    "中山南一路": "黄浦区",
    "东平路": "徐汇区",
    "银城路": "浦东新区",
    "凤阳路": "静安区",
    "泸定路": "普陀区",
    "蒲汇塘路": "徐汇区",
    "南丹东路": "徐汇区",
    "定兴路": "静安区",
    "香花桥路": "长宁区",
    "柳林路": "黄浦区",
    "杨树浦路": "杨浦区",
}

for road, district in additions.items():
    if road not in cfg["road_to_district"]:
        cfg["road_to_district"][road] = district

with open(CONFIG, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)

print("已追加路名映射：", additions)
