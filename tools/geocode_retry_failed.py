#!/usr/bin/env python3
"""
对高德地理编码失败的行进行重试。
策略：清洗地址，去掉括号内的补充说明、楼层、营业时间等，只保留路名+门牌号部分。
用法：
  python3 tools/geocode_retry_failed.py \
    --input outputs/大众点评_合并_带经纬度.csv \
    --key YOUR_AMAP_KEY
"""
import argparse
import csv
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

API_URL = "https://restapi.amap.com/v3/geocode/geo"


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


def clean_address(address):
    """去掉括号及后面冗长的补充说明，保留主干地址。"""
    # 去掉各种括号内容
    cleaned = re.sub(r"[（(].*?[）)]", "", address)
    # 去掉“近...”等补充
    cleaned = re.sub(r"[（(]近.*?[）)]", "", cleaned)
    # 去掉楼层、室等可能干扰的片段（保留到“号”或“路/街”后的主要部分）
    # 但不做过度清洗，避免把核心门牌号也删掉
    cleaned = cleaned.replace("、", " ").replace("，", " ").replace(",", " ")
    return cleaned.strip()


def main():
    parser = argparse.ArgumentParser(description="重试地理编码失败的地址")
    parser.add_argument("--input", "-i", required=True, help="带经纬度的 CSV 路径")
    parser.add_argument("--key", "-k", required=True, help="高德 Web 服务 Key")
    parser.add_argument("--delay", "-d", type=float, default=0.25, help="请求间隔秒数")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    failed_indexes = [
        i for i, r in enumerate(rows) if r.get("地理编码状态") != "成功"
    ]
    print(f"待重试失败行数：{len(failed_indexes)}")

    success = 0
    still_failed = 0

    for count, i in enumerate(failed_indexes, start=1):
        row = rows[i]
        original = row.get("地址", "").strip()
        cleaned = clean_address(original)
        city = row.get("城市", "上海").strip() or "上海"
        name = row.get("店名", "") or f"第{i + 2}行"

        addresses_to_try = [cleaned]
        if cleaned != original:
            addresses_to_try.append(original)

        coords = None
        err = ""
        for addr in addresses_to_try:
            print(f"[{count}/{len(failed_indexes)}] {name} -> {addr[:50]}...", end=" ")
            coords, err = geocode(addr, city, args.key)
            if coords:
                break
            print(f"❌ {err}")
            time.sleep(args.delay)

        if coords:
            lng, lat = coords
            row["经度"] = lng
            row["纬度"] = lat
            row["地理编码状态"] = "成功（重试）"
            print(f"✅ {lng}, {lat}")
            success += 1
        else:
            row["地理编码状态"] = f"重试仍失败: {err}"
            print(f"❌ 重试失败: {err}")
            still_failed += 1

        time.sleep(args.delay)

    # 写回同一文件
    with open(args.input, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n重试完成：成功 {success} 行，仍失败 {still_failed} 行")


if __name__ == "__main__":
    main()
