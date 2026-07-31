#!/usr/bin/env python3
"""
用“大众点评_合并.csv”补全“大众点评0731.csv”：
- 输出格式遵循 0731 的表头
- 补全 0731 中缺失的字段（来源：合并）
- 追加合并中有、但 0731 中没有的店铺
- 新增经度、纬度列

用法：
  python3 tools/enrich_0731_from_merge.py --key YOUR_AMAP_KEY
"""
import argparse
import csv
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MERGE_PATH = Path("/Users/aaaa/Downloads/大众点评_合并.csv")
TARGET_PATH = Path("/Users/aaaa/Downloads/大众点评0731.csv")
COORD_SOURCE = ROOT / "outputs" / "大众点评_合并_带经纬度.csv"
OUTPUT = ROOT / "outputs" / "大众点评0731_补全.csv"

API_URL = "https://restapi.amap.com/v3/geocode/geo"


def detect_encoding(path):
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb2312"):
        try:
            with open(path, "r", encoding=enc) as f:
                f.read(1024)
            return enc
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "utf-8"


def read_rows(path):
    enc = detect_encoding(path)
    with open(path, "r", encoding=enc, newline="") as f:
        reader = csv.DictReader(f)
        return reader.fieldnames or [], list(reader)


def normalize_key(url):
    return url.strip().lower().rstrip("/")


def clean_address(address):
    """地理编码前清洗地址，去掉冗长括号说明。"""
    cleaned = re.sub(r"[（(].*?[）)]", "", address)
    cleaned = cleaned.replace("、", " ").replace("，", " ").replace(",", " ")
    return cleaned.strip() or address.strip()


def geocode(address, city, key):
    params = {
        "key": key,
        "address": address,
        "city": city,
        "output": "JSON",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return None, f"请求异常: {e}"

    if data.get("status") != "1":
        return None, f"API 错误: {data.get('info', '')}"

    geocodes = data.get("geocodes", [])
    if not geocodes:
        return None, "无匹配结果"

    location = geocodes[0].get("location", "")
    if not location or "," not in location:
        return None, "返回坐标格式异常"

    lng, lat = location.split(",")
    return (lng.strip(), lat.strip()), None


def get_coords_with_fallback(address, city, key):
    """先尝试完整地址，失败则尝试清洗后的主干地址。"""
    for addr in [address, clean_address(address)]:
        if not addr:
            continue
        coords, err = geocode(addr, city, key)
        if coords:
            return coords, None
        time.sleep(0.25)
    return None, err


def main():
    parser = argparse.ArgumentParser(description="用合并文件补全大众点评0731并加经纬度")
    parser.add_argument("--key", "-k", required=True, help="高德 Web 服务 Key")
    parser.add_argument("--delay", "-d", type=float, default=0.25, help="请求间隔秒数")
    args = parser.parse_args()

    merge_header, merge_rows = read_rows(MERGE_PATH)
    target_header, target_rows = read_rows(TARGET_PATH)

    # 读取已有的坐标数据源
    coord_lookup = {}
    if COORD_SOURCE.exists():
        _, coord_rows = read_rows(COORD_SOURCE)
        for r in coord_rows:
            url = normalize_key(r.get("大众点评链接", ""))
            if url:
                coord_lookup[url] = (r.get("经度", ""), r.get("纬度", ""))

    # 合并文件按 URL 建立索引
    merge_by_url = {}
    for r in merge_rows:
        url = normalize_key(r.get("大众点评链接", ""))
        if url:
            merge_by_url[url] = r

    # 输出表头：按 0731 格式，追加经纬度
    out_header = list(target_header)
    for col in ("经度", "纬度"):
        if col not in out_header:
            out_header.append(col)

    # 1. 先处理 0731 本身的所有行
    out_rows = []
    target_urls = set()
    for r in target_rows:
        url = normalize_key(r.get("大众点评链接", ""))
        if url:
            target_urls.add(url)
            # 用合并文件补全空字段
            source = merge_by_url.get(url, {})
            for col in target_header:
                if not r.get(col) and source.get(col):
                    r[col] = source[col]

        # 加坐标
        lng, lat = "", ""
        if url and url in coord_lookup:
            lng, lat = coord_lookup[url]
        if not lng and r.get("地址"):
            coords, _ = get_coords_with_fallback(r["地址"], r.get("城市", "上海"), args.key)
            if coords:
                lng, lat = coords
                time.sleep(args.delay)
        r["经度"] = lng
        r["纬度"] = lat
        out_rows.append(r)

    # 2. 追加合并文件中有、但 0731 中没有的店铺
    added = 0
    for r in merge_rows:
        url = normalize_key(r.get("大众点评链接", ""))
        if url and url not in target_urls:
            # 按 target_header 对齐
            new_row = {col: "" for col in target_header}
            for col in target_header:
                new_row[col] = r.get(col, "")

            # 加坐标
            lng, lat = "", ""
            if url in coord_lookup:
                lng, lat = coord_lookup[url]
            if not lng and r.get("地址"):
                coords, _ = get_coords_with_fallback(r["地址"], r.get("城市", "上海"), args.key)
                if coords:
                    lng, lat = coords
                    time.sleep(args.delay)
            new_row["经度"] = lng
            new_row["纬度"] = lat
            out_rows.append(new_row)
            added += 1

    # 补齐列
    for r in out_rows:
        for col in out_header:
            if col not in r:
                r[col] = ""

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=out_header)
        writer.writeheader()
        writer.writerows(out_rows)

    # 统计
    with_coords = sum(1 for r in out_rows if r.get("经度"))
    without_coords = len(out_rows) - with_coords

    print(f"完成：")
    print(f"  - 0731 原行数：{len(target_rows)}")
    print(f"  - 从合并文件追加：{added} 行")
    print(f"  - 输出总行数：{len(out_rows)}")
    print(f"  - 有坐标：{with_coords} 行，无坐标：{without_coords} 行")
    print(f"  - 输出：{OUTPUT}")

    if without_coords:
        print("\n无坐标的店铺：")
        for r in out_rows:
            if not r.get("经度"):
                print(f"  - {r.get('店名')}: {r.get('地址')}")


if __name__ == "__main__":
    main()
