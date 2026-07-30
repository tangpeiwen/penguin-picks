#!/usr/bin/env python3
"""Split the generated 4x4 icon atlas into normalized red and white PNG assets."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "icon-atlas" / "icon-atlas-transparent.png"
OUTPUT = ROOT / "miniprogram" / "assets" / "icons"

NAMES = [
    "date",
    "guest",
    "friends",
    "solo",
    "parents",
    "talk",
    "people-1",
    "people-2",
    "people-4",
    "people-6",
    "location",
    "cuisine",
    "price",
    "diet",
    "mascot",
    "food",
]

COLORS = {
    "red": (127, 33, 31),
    "white": (255, 250, 242),
}


def recolor(image: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    alpha = image.getchannel("A")
    color = Image.new("RGBA", image.size, (*rgb, 255))
    color.putalpha(alpha)
    return color


def normalize(image: Image.Image, size: int = 256, occupied: int = 214) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cropped = image.crop(bbox)
    scale = min(occupied / cropped.width, occupied / cropped.height)
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def main() -> None:
    atlas = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    width, height = atlas.size

    for index, name in enumerate(NAMES):
        row, column = divmod(index, 4)
        left = round(column * width / 4)
        top = round(row * height / 4)
        right = round((column + 1) * width / 4)
        bottom = round((row + 1) * height / 4)
        icon = normalize(atlas.crop((left, top, right, bottom)))
        for tone, rgb in COLORS.items():
            recolor(icon, rgb).save(OUTPUT / f"{name}-{tone}.png", optimize=True)

    print(f"Wrote {len(NAMES) * len(COLORS)} icon assets to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
