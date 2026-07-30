#!/usr/bin/env python3
"""
使用高德地图地理编码 API 批量把地址转成经纬度。
用法示例：
  python3 tools/geocode_addresses.py \
    --input outputs/大众点评_合并.csv \
    --output outputs/大众点评_合并_带经纬度.csv \
    --key YOUR_AMAP_KEY

高德地理编码 API：
  https://lbs.amap.com/api/webservice/guide/api/georegeo
"""
import argparse
import csv
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

API_URL = "https://restapi.amap.com/v3/geocode/geo"
DEFAULT_DELAY = 0.25  # 秒，避免触发限流


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
        return list(reader), reader.fieldnames or []


def geocode(address, city, key):
    """调用高德地理编码 API，返回 (lng, lat) 或 None。"""
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

    status = data.get("status")
    info = data.get("info", "")
    if status != "1":
        return None, f"API 错误: {info}"

    geocodes = data.get("geocodes", [])
    if not geocodes:
        return None, "无匹配结果"

    location = geocodes[0].get("location", "")
    if not location or "," not in location:
        return None, "返回坐标格式异常"

    lng, lat = location.split(",")
    return (lng.strip(), lat.strip()), None


def main():
    parser = argparse.ArgumentParser(description="批量地址转经纬度（高德地理编码 API）")
    parser.add_argument("--input", "-i", required=True, help="输入 CSV 路径")
    parser.add_argument("--output", "-o", required=True, help="输出 CSV 路径")
    parser.add_argument("--key", "-k", required=True, help="高德 Web 服务 Key")
    parser.add_argument("--delay", "-d", type=float, default=DEFAULT_DELAY, help="请求间隔秒数")
    args = parser.parse_args()

    rows, fieldnames = read_rows(args.input)

    # 确保输出包含经纬度列
    new_fieldnames = fieldnames.copy()
    for col in ("经度", "纬度", "地理编码状态"):
        if col not in new_fieldnames:
            new_fieldnames.append(col)

    out_rows = []
    success = 0
    failed = 0

    for i, row in enumerate(rows, start=1):
        address = row.get("地址", "").strip()
        city = row.get("城市", "上海").strip() or "上海"
        name = row.get("店名", "") or f"第{i}行"

        if not address:
            row["经度"] = ""
            row["纬度"] = ""
            row["地理编码状态"] = "地址为空"
            out_rows.append(row)
            failed += 1
            continue

        print(f"[{i}/{len(rows)}] {name} -> {address[:40]}...", end=" ")
        coords, err = geocode(address, city, args.key)
        if coords:
            lng, lat = coords
            row["经度"] = lng
            row["纬度"] = lat
            row["地理编码状态"] = "成功"
            print(f"✅ {lng}, {lat}")
            success += 1
        else:
            row["经度"] = ""
            row["纬度"] = ""
            row["地理编码状态"] = err
            print(f"❌ {err}")
            failed += 1

        out_rows.append(row)
        if i < len(rows):
            time.sleep(args.delay)

    # 补齐可能缺失的列
    for row in out_rows:
        for col in new_fieldnames:
            if col not in row:
                row[col] = ""

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=new_fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"\n完成：共 {len(rows)} 行，成功 {success} 行，失败 {failed} 行")
    print(f"输出：{args.output}")


if __name__ == "__main__":
    main()
