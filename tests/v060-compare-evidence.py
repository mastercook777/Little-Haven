#!/usr/bin/env python3
"""V0.6 art gate companion: compare actually rendered baseline and candidate PNGs.
This emits observations, NOT an automatic judgement of beauty or gameplay.
Requires Pillow. Run after tests/v060-visual-evidence.mjs captured both trees.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageOps, ImageStat

parser = argparse.ArgumentParser()
parser.add_argument("--root", default="artifacts/evidence/v060")
args = parser.parse_args()
root = Path(args.root)
baseline = root / "baseline"
candidate = root / "phase-a"
target = root / "comparisons"
target.mkdir(parents=True, exist_ok=True)
a = json.loads((baseline / "manifest.json").read_text(encoding="utf-8"))
b = json.loads((candidate / "manifest.json").read_text(encoding="utf-8"))
a_by_name = {x["name"]: x for x in a["captures"]}
b_by_name = {x["name"]: x for x in b["captures"]}
if a_by_name.keys() != b_by_name.keys():
    raise SystemExit("Refusing unmatched baselines and candidate captures: " +
                     repr((set(a_by_name)-set(b_by_name), set(b_by_name)-set(a_by_name))))

def thumbnail(im: Image.Image, max_w: int = 460, max_h: int = 480):
    scale = min(max_w / im.width, max_h / im.height)
    return im.resize((round(im.width * scale), round(im.height * scale)),
                     Image.Resampling.LANCZOS)

def stats(left: Image.Image, right: Image.Image, tolerance: int = 26):
    if left.size != right.size:
        raise ValueError(f"Comparison image dimensions differ: {left.size} vs {right.size}")
    difference = ImageChops.difference(left.convert("RGB"), right.convert("RGB"))
    luminance = ImageOps.grayscale(difference)
    mask = luminance.point(lambda v: 255 if v >= tolerance else 0)
    changed_pixels = mask.histogram()[255]
    total = left.width * left.height
    mean = ImageStat.Stat(difference).mean
    return {
        "width": left.width,
        "height": left.height,
        "threshold_rgb_difference": tolerance,
        "mean_absolute_channel_difference": round(sum(mean) / 3, 3),
        "fraction_changed_above_threshold": round(changed_pixels / total, 5),
        "pixels_changed": changed_pixels,
        "total_pixels": total,
    }, mask

def comparison_sheet(name, old, new, delta, observations):
    images = [thumbnail(old.convert("RGB")),
              thumbnail(new.convert("RGB")),
              thumbnail(delta.convert("RGB"))]
    widths = [im.width for im in images]
    cell_w = max(widths) + 18
    cell_h = max(im.height for im in images) + 15
    result = Image.new("RGB", (cell_w * 3, cell_h + 66), (242, 238, 230))
    draw = ImageDraw.Draw(result)
    for idx, (im, heading) in enumerate(zip(
        images, ("BASELINE / main", "CANDIDATE / Phase A", "PIXEL DIFF > 26"))):
        x = idx * cell_w + 9
        draw.text((x, 8), heading, fill=(30, 38, 41))
        result.paste(im, (x, 30))
    summary = f"seed / view / date: {name}    changed={observations['fraction_changed_above_threshold']:.1%}    mean delta={observations['mean_absolute_channel_difference']:.2f}"
    draw.text((10, cell_h + 35), summary[:220], fill=(36, 42, 43))
    result.save(target / (name + "-side-by-side.png"))

rows = []
for name in sorted(a_by_name):
    x, y = a_by_name[name], b_by_name[name]
    for field in ("seed", "yearDay", "viewportName", "viewport"):
        if x[field] != y[field]:
            raise SystemExit(f"Unaligned {field} in {name}: {x[field]} vs {y[field]}")
    # Deterministic same world input; code changes are allowed to produce
    # different buildings, people and render metrics, not different cameras.
    with Image.open(baseline / (name + ".png")) as old_file, Image.open(
        candidate / (name + ".png")) as new_file:
        old, new = old_file.convert("RGB"), new_file.convert("RGB")
        observations, mask = stats(old, new)
        comparison_sheet(name, old, new, mask, observations)
    with Image.open(baseline / (name + "-gray.png")) as gray_old, Image.open(
        candidate / (name + "-gray.png")) as gray_new:
        gray_change, _ = stats(gray_old, gray_new)
    rows.append({
        "name": name,
        "seed": x["seed"],
        "viewport": x["viewportName"],
        "day": x["yearDay"],
        "baseline_buildings": len(x["buildings"]),
        "candidate_buildings": len(y["buildings"]),
        "baseline_residents": x["founders"],
        "candidate_residents": y["founders"],
        "baseline_draw_calls": x["renderer"]["calls"],
        "candidate_draw_calls": y["renderer"]["calls"],
        "baseline_triangles": x["renderer"]["triangles"],
        "candidate_triangles": y["renderer"]["triangles"],
        "full_screenshot": observations,
        "grayscale_world_canvas": gray_change
    })
(target / "comparison.json").write_text(json.dumps({
    "disclaimer": "Pixel changes are factual differences, not a substitute for independent aesthetic review. Layout changes, shadows, weather, and antialiasing also affect the measure.",
    "aligned_images": len(rows),
    "results": rows
}, ensure_ascii=False, indent=2), encoding="utf-8")
print("Compared", len(rows), "same-seed, same-viewport images")
for row in rows:
    print(row["name"],
          "changed", f"{row['full_screenshot']['fraction_changed_above_threshold']:.1%}",
          "residents", f"{row['baseline_residents']} → {row['candidate_residents']}",
          "draw", f"{row['baseline_draw_calls']} → {row['candidate_draw_calls']}")
