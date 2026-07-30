#!/usr/bin/env python3
"""Build the mini-program's compact restaurant dataset from the reviewed CSV rows."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "大众点评_合并.csv"
TARGET = ROOT / "miniprogram" / "data" / "restaurants.js"


def split_tags(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"[,，、/]", value or "") if part.strip()]


def price_range(value: str) -> tuple[int, int]:
    value = (value or "").strip()
    if value.startswith("<"):
        return 0, int(re.sub(r"\D", "", value) or 100)
    if value.endswith("+"):
        start = int(re.sub(r"\D", "", value) or 0)
        return start, 9999
    numbers = [int(number) for number in re.findall(r"\d+", value)]
    return (numbers[0], numbers[1]) if len(numbers) >= 2 else (0, 9999)


def max_people(value: str) -> int:
    numbers = [int(number) for number in re.findall(r"(\d+)\s*人", value or "")]
    return max(numbers) if numbers else 6


def reservation(value: str) -> tuple[str, str]:
    text = value or ""
    if any(term in text for term in ("不太排队", "不太需要排队", "无需排队", "不需要排队")):
        return "easy", "通常不用等"
    if any(term in text for term in ("提前", "会排队", "需要排队", "订不到", "抢")):
        return "hard", "最好提前订"
    if any(term in text for term in ("预订", "预定", "订座", "电话", "微信")):
        return "medium", "可提前订"
    if "排队" in text:
        return "medium", "可能要等位"
    return "easy", "到店即可"


def occasions(row: dict[str, str], low: int) -> list[str]:
    source = row.get("场合", "")
    review = row.get("评价", "")
    tags: list[str] = []
    mapping = {
        "约会": "date",
        "好友聚餐": "friends",
        "朋友聚会": "friends",
        "一人食": "solo",
        "家庭聚餐": "parents",
        "商务": "talk",
    }
    for original, normalized in mapping.items():
        if original in source and normalized not in tags:
            tags.append(normalized)
    if any(term in source for term in ("生日", "商务", "家庭聚餐")) or (
        low >= 200 and any(term in review for term in ("环境好", "包间", "服务", "体面"))
    ):
        tags.append("guest")
    if not tags:
        if any(term in review for term in ("商务", "环境非常好", "包间")):
            tags.extend(["talk", "guest"])
        elif any(term in review for term in ("喝点小酒", "几个人", "聚一聚", "社区餐厅")):
            tags.append("friends")
        else:
            tags.append("browse")
    return list(dict.fromkeys(tags))


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


def diet_flags(cuisines: list[str], review: str) -> list[str]:
    joined = " ".join(cuisines) + " " + (review or "")
    flags: list[str] = []
    if not any(term in joined for term in ("川菜", "湘菜", "辣", "火锅")):
        flags.append("no-spicy")
    if not any(term in joined for term in ("海鲜", "潮汕", "宁波", "鱼", "蟹", "虾")):
        flags.append("no-seafood")
    if any(term in joined for term in ("素食", "蔬菜", "轻食")):
        flags.append("vegetarian")
    return flags


def main() -> None:
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as source:
        reviewed = [row for row in csv.DictReader(source) if (row.get("评价") or "").strip()]

    restaurants = []
    for index, row in enumerate(reviewed, start=1):
        low, high = price_range(row.get("人均", ""))
        cuisines = split_tags(row.get("菜系", ""))
        reservation_level, reservation_label = reservation(row.get("订位", ""))
        restaurant = {
            "id": row.get("店铺ID") or f"restaurant-{index}",
            "name": (row.get("店名") or "未命名餐厅").strip(),
            "cuisines": cuisines,
            "priceLabel": (row.get("人均") or "价格待确认").strip(),
            "priceMin": low,
            "priceMax": high,
            "occasions": occasions(row, low),
            "maxPeople": max_people(row.get("人数", "")),
            "reservationLevel": reservation_level,
            "reservationLabel": reservation_label,
            "reservationNote": (row.get("订位") or "建议到店前确认").strip(),
            "review": short_review(row.get("评价", "")),
            "fullReview": (row.get("评价") or "").strip(),
            "district": (row.get("行政区") or "").strip(),
            "region": (row.get("商圈标签") or "").strip(),
            "address": (row.get("地址") or "").strip(),
            "star": float(row.get("星级") or 0),
            "diet": diet_flags(cuisines, row.get("评价", "")),
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
    print(f"Wrote {len(restaurants)} reviewed restaurants to {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
