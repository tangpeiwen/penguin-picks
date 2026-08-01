#!/usr/bin/env python3
"""Build the mini-program's compact restaurant dataset from the reviewed CSV rows."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "大众点评_吃过.csv"
TARGET = ROOT / "miniprogram" / "data" / "restaurants.js"


def split_tags(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"[,，、/]", value or "") if part.strip()]


def meal_times(value: str) -> list[str]:
    tags: list[str] = []
    mapping = {
        "brunch": "brunch",
        "早午": "brunch",
        "中饭": "lunch",
        "午饭": "lunch",
        "午餐": "lunch",
        "晚饭": "dinner",
        "晚餐": "dinner",
        "夜宵": "late-night",
    }
    text = value or ""
    lowered = text.lower()
    for original, normalized in mapping.items():
        source = lowered if original == "brunch" else text
        if original in source and normalized not in tags:
            tags.append(normalized)
    return tags


REGION_ALIASES = {
    "衡山路/复兴西路": "衡山复兴",
    "衡山复兴": "衡山复兴",
    "古北/虹桥": "古北虹桥",
    "古北虹桥": "古北虹桥",
}


def mapped_regions(value: str) -> list[str]:
    """Keep one reviewed primary 片区 for compact result-card display."""
    parts = [part.strip() for part in re.split(r"[,，、]", value or "") if part.strip()]
    return [REGION_ALIASES.get(parts[0], parts[0])] if parts else []


def has_visited(value: str) -> bool:
    """Treat only an explicit truthy marker as visited; blanks belong to the wishlist."""
    return (value or "").strip().lower() in {"1", "true", "yes", "是", "去过", "吃过"}


def split_dish_names(value: str) -> list[str]:
    text = (value or "").strip(" ，,、/；;！!")
    if not text:
        return []
    parts = re.split(r"[、,，/；;！!\s]+", text)
    dishes: list[str] = []
    for part in parts:
        dish = part.strip()
        if dish and dish not in dishes:
            dishes.append(dish)
    return dishes[:7]


def dish_names(row: dict[str, str]) -> list[str]:
    """Use only the reviewed CSV dish field; never infer or pad missing dishes."""
    dishes = split_dish_names(row.get("点菜", ""))
    return dishes


def coordinate(row: dict[str, str], names: tuple[str, ...]) -> Optional[float]:
    for name in names:
        value = (row.get(name) or "").strip()
        if not value:
            continue
        try:
            return float(value)
        except ValueError:
            pass
    return None


def building_name(address: str) -> str:
    """Extract a compact mall/building name for the result-list location line."""
    text = re.split(r"[（(]", address or "", maxsplit=1)[0]
    suffixes = (
        "购物中心", "金融中心", "嘉里中心", "国金中心", "信德中心", "外滩金融中心",
        "港汇恒隆广场", "恒隆广场", "新世纪广场", "上海广场", "广场", "大厦", "商城", "商场",
        "前滩太古里", "太古里", "万象天地", "新天地", "来福士广场", "来福士", "里", "坊",
    )
    suffix_parts = []
    for suffix in sorted(suffixes, key=len, reverse=True):
        # Do not let the generic “里” suffix truncate names such as “嘉里中心”.
        suffix_parts.append(r"里(?!中心)" if suffix == "里" else re.escape(suffix))
    suffix_pattern = "|".join(suffix_parts)
    candidates = re.findall(rf"([^0-9A-Za-z\s，,、]{{0,10}}[A-Za-z0-9·一-鿿]{{1,18}}?(?:{suffix_pattern}))", text)
    if not candidates:
        return ""
    candidate = candidates[-1]
    candidate = re.split(r"(?:街道|镇|路|街|弄|号)", candidate)[-1]
    return candidate.strip("，,、- ")[:20]


def price_range(value: str) -> tuple[int, int]:
    value = (value or "").strip()
    if value.startswith("<"):
        return 0, int(re.sub(r"\D", "", value) or 100)
    if value.endswith("+"):
        start = int(re.sub(r"\D", "", value) or 0)
        return start, 9999
    numbers = [int(number) for number in re.findall(r"\d+", value)]
    if len(numbers) >= 2:
        return numbers[0], numbers[1]
    if len(numbers) == 1:
        return numbers[0], numbers[0]
    return 0, 9999


def max_people(value: str) -> int:
    numbers = [int(number) for number in re.findall(r"\d+", value or "")]
    return max(numbers) if numbers else 6


def reservation(value: str) -> tuple[str, str]:
    text = re.sub(r"\s+", "", value or "")
    queue_warning = any(term in text for term in (
        "会排队", "要排队", "需要排队", "可能排队", "偶尔排队", "必排队",
        "排队很久", "排很久", "排队1小时", "高峰期",
    ))
    no_queue = any(term in text for term in (
        "不太排队", "不太需要排队", "无需排队", "不需要排队", "不用排队",
        "不排队", "不大需要排队", "基本不用排", "基本不排", "一般不排",
        "应该不排队", "不需要",
    ))
    if no_queue and not queue_warning:
        return "easy", "基本不用排队"
    if any(term in text for term in ("必排队", "排队很久", "排很久", "排队1小时", "订不到", "抢位置")):
        return "hard", "建议提前安排"
    if "提前" in text:
        return "hard", "建议提前订"
    if "排队" in text or "排很久" in text:
        return "medium", "可能要排队"
    if any(term in text for term in ("预订", "预定", "订座", "电话", "微信")):
        return "medium", "可提前订"
    return "easy", "到店即可"


def reservation_display(value: str) -> str:
    """Keep only booking information that meaningfully deviates from the default."""
    text = re.sub(r"\s+", "", value or "")
    if not text:
        return ""
    timing = re.search(r"(?:至少)?提前\d+(?:-\d+)?(?:天|周|个月|小时)", text)
    if timing:
        label = timing.group(0).replace("-", "–")
        if "不太walkin" in text:
            return f"不太能 walk-in · {label}"
        return label if label.startswith("至少") else f"需{label}"
    if any(term in text for term in ("不接受预订", "不接受预定", "不能预订", "不能预定", "不太walkin")):
        return (value or "").strip()
    if "抢位置" in text:
        return "小程序3点抢位"
    if "线下排队" in text:
        return "仅线下排队"
    if "现场取号" in text or "排队很久" in text:
        return "现场取号，排队较久"
    if "无法线上取号" in text or "不能线上取号" in text:
        return "高峰期排队 · 不能线上取号" if "高峰期" in text else "不能线上取号"
    return ""


def occasions(row: dict[str, str]) -> list[str]:
    source = row.get("场合", "")
    tags: list[str] = []
    mapping = {
        "约会": ("date",),
        "请客": ("guest",),
        "谈事": ("talk",),
        "好友聚餐": ("friends",),
        "朋友聚会": ("friends",),
        "一人食": ("solo",),
        "家庭聚餐": ("parents",),
        "生日": ("birthday",),
        "随便吃吃": ("casual",),
        # Compatibility for exports saved before 请客 / 谈事 were split.
        "商务": ("guest", "talk"),
    }
    for original, normalized_values in mapping.items():
        if original in source:
            tags.extend(normalized_values)
    return list(dict.fromkeys(tags)) or ["browse"]


def short_review(value: str) -> str:
    text = re.sub(r"\s+", "", value or "").replace("大众点评大众点评", "大众点评")
    sentences = [part for part in re.split(r"[。！？]", text) if part]
    chosen: list[str] = []
    for sentence in sentences:
        if any(term in sentence for term in ("适合", "环境", "店面", "社区", "人均", "推荐", "好吃", "家常")):
            chosen.append(sentence)
        if len("，".join(chosen)) >= 30:
            break
    result = "，".join(chosen) or (sentences[0] if sentences else "值得放进口袋名单的一家店")
    result = result[:48].rstrip("，,；;")
    return result + "。"


def diet_flags(row: dict[str, str], cuisines: list[str]) -> list[str]:
    joined = " ".join(
        [
            row.get("店名", ""),
            " ".join(cuisines),
            row.get("点菜", ""),
            row.get("评价", ""),
            row.get("避雷", ""),
        ]
    )
    beef_text = joined.replace("牛蛙", "")
    flags: list[str] = []
    if not any(term in joined for term in ("川菜", "湘菜", "辣", "火锅")):
        flags.append("no-spicy")
    if not any(term in joined for term in ("海鲜", "潮汕", "宁波", "鱼", "蟹", "虾", "贝", "蚝", "螺", "海胆", "海肠")):
        flags.append("no-seafood")
    if "牛" not in beef_text:
        flags.append("no-beef")
    if any(term in joined.lower() for term in ("素食", "纯素", "全素", "vegan", "vegetarian")):
        flags.append("vegetarian")
    return flags


def main() -> None:
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as source:
        source_rows = [row for row in csv.DictReader(source) if (row.get("评价") or "").strip()]

    reviewed = []
    seen_ids: set[str] = set()
    duplicate_count = 0
    for row in source_rows:
        restaurant_id = (row.get("店铺ID") or "").strip()
        if restaurant_id and restaurant_id in seen_ids:
            duplicate_count += 1
            continue
        if restaurant_id:
            seen_ids.add(restaurant_id)
        reviewed.append(row)

    restaurants = []
    for index, row in enumerate(reviewed, start=1):
        low, high = price_range(row.get("人均", ""))
        cuisines = split_tags(row.get("菜系", ""))
        dishes = dish_names(row)
        reservation_level, reservation_label = reservation(row.get("订位", ""))
        latitude = coordinate(row, ("纬度", "latitude", "lat"))
        longitude = coordinate(row, ("经度", "longitude", "lng", "lon"))
        restaurant = {
            "id": row.get("店铺ID") or f"restaurant-{index}",
            "name": (row.get("店名") or "未命名餐厅").strip(),
            "visited": has_visited(row.get("去过", "")),
            "cuisines": cuisines,
            "dishes": dishes,
            "priceLabel": (row.get("人均") or "价格待确认").strip(),
            "priceMin": low,
            "priceMax": high,
            "occasions": occasions(row),
            "mealTimes": meal_times(row.get("营业时间", "")),
            "maxPeople": max_people(row.get("人数", "")),
            "reservationLevel": reservation_level,
            "reservationLabel": reservation_label,
            "reservationNote": (row.get("订位") or "建议到店前确认").strip(),
            "reservationDisplay": reservation_display(row.get("订位", "")),
            "pitfall": (row.get("避雷") or "").strip(),
            "review": short_review(row.get("评价", "")),
            "fullReview": (row.get("评价") or "").strip(),
            "district": (row.get("行政区") or "").strip(),
            "region": (row.get("商圈标签") or "").strip(),
            "areas": mapped_regions(row.get("片区", "")),
            "address": (row.get("地址") or "").strip(),
            "building": building_name(row.get("地址", "")),
            "latitude": latitude,
            "longitude": longitude,
            "star": float(row.get("星级") or 0),
            "diet": diet_flags(row, cuisines),
            "url": (row.get("大众点评链接") or "").strip(),
        }
        restaurants.append(restaurant)

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(restaurants, ensure_ascii=False, separators=(",", ":"))
    TARGET.write_text(
        "// Generated by tools/build_miniprogram_data.py; do not edit by hand.\n"
        f"module.exports = {payload};\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {len(restaurants)} reviewed restaurants to {TARGET.relative_to(ROOT)}"
        f"; skipped {duplicate_count} duplicate shop IDs"
    )


if __name__ == "__main__":
    main()
