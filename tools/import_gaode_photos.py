#!/usr/bin/env python3
"""Import reviewed Gaode restaurant photos as compact local thumbnails."""

from __future__ import annotations

import csv
import subprocess
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "大众点评_吃过.csv"
PHOTO_DIR = ROOT / "outputs" / "高德图片"
TARGET_DIR = ROOT / "miniprogram" / "assets" / "restaurants"


def normalized_name(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip())


def main() -> None:
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as source:
        reviewed = [row for row in csv.DictReader(source) if (row.get("评价") or "").strip()]

    photos_by_name = {normalized_name(path.stem): path for path in PHOTO_DIR.glob("*.jpg")}
    # The reviewed export has two similarly named files for this shop. Prefer
    # the exact name when it exists; otherwise accept the numbered variant.
    if "细记港九宵夜大牌档" not in photos_by_name and "细记港九宵夜大牌档_2" in photos_by_name:
        photos_by_name["细记港九宵夜大牌档"] = photos_by_name["细记港九宵夜大牌档_2"]

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    imported: list[str] = []
    imported_targets: set[Path] = set()
    missing: list[str] = []
    failed: list[tuple[str, str]] = []

    for index, row in enumerate(reviewed, start=1):
        restaurant_id = (row.get("店铺ID") or "").strip() or f"restaurant-{index}"
        name = (row.get("店名") or "").strip()
        source_photo = photos_by_name.get(normalized_name(name))
        if not source_photo:
            missing.append(name)
            continue

        target = TARGET_DIR / f"{restaurant_id}.jpg"
        try:
            subprocess.run(
                [
                    "magick",
                    str(source_photo),
                    "-auto-orient",
                    "-resize",
                    "360x360^",
                    "-gravity",
                    "center",
                    "-extent",
                    "360x360",
                    "-strip",
                    "-quality",
                    "78",
                    str(target),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            imported.append(name)
            imported_targets.add(target)
        except subprocess.CalledProcessError as error:
            failed.append((name, error.stderr.decode("utf-8", "ignore")[:160]))

    for stale_photo in TARGET_DIR.glob("*.jpg"):
        if stale_photo not in imported_targets:
            stale_photo.unlink()

    print(f"Imported {len(imported)} restaurant photos to {TARGET_DIR.relative_to(ROOT)}")
    if missing:
        print(f"Missing photos for {len(missing)} rows: {', '.join(dict.fromkeys(missing))}")
    if failed:
        print(f"Failed to convert {len(failed)} photos: {failed}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
