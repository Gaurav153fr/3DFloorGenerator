import cv2
import numpy as np
import os

# --- Calibration ---
# Assumes the floor plan scale bar reads ~41px = 1 metre (adjust to your image).
# get_Cordinates() returns this so app.py can pass it to material analysis.
PIXELS_PER_METRE = 41.0

def _px_to_m(px: float) -> float:
    return round(px / PIXELS_PER_METRE, 3)

def _classify_wall(x1, y1, x2, y2, img_w, img_h, length_px, all_lengths):
    """
    Heuristic wall classifier → 'load_bearing_wall' | 'partition_wall'

    Rules (in priority order):
      1. Outer walls  → any wall whose midpoint is within 8% of any image edge
      2. Long walls   → length >= 75th percentile of all walls  → loapipd-bearing
      3. Short walls  → below median → partition
    """
    mx = (x1 + x2) / 2
    my = (y1 + y2) / 2
    margin_x = img_w * 0.08
    margin_y = img_h * 0.08

    is_outer = (mx < margin_x or mx > img_w - margin_x or
                my < margin_y or my > img_h - margin_y)
    if is_outer:
        return "load_bearing_wall", True

    p75 = float(np.percentile(all_lengths, 75))
    if length_px >= p75:
        return "load_bearing_wall", False

    return "partition_wall", False


def get_Cordinates():
    file_path = os.path.join(os.path.dirname(__file__), 'test', 'F2.png')
    img = cv2.imread(file_path)

    if img is None:
        print(f"Error: Could not find image at {file_path}")
        exit()

    img_h, img_w = img.shape[:2]

    # --- Pre-processing ---
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    clean_walls = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    clean_walls = cv2.medianBlur(clean_walls, 3)

    # --- Line Detection ---
    lines = cv2.HoughLinesP(clean_walls, 1, np.pi / 180,
                            threshold=40, minLineLength=60, maxLineGap=10)

    raw_walls = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if abs(x1 - x2) < 10 or abs(y1 - y2) < 10:   # H or V only
                length_px = float(np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2))
                raw_walls.append((x1, y1, x2, y2, length_px))

    if not raw_walls:
        return []

    all_lengths = [w[4] for w in raw_walls]

    wall_list = []
    for idx, (x1, y1, x2, y2, length_px) in enumerate(raw_walls):
        wall_type, is_outer = _classify_wall(
            x1, y1, x2, y2, img_w, img_h, length_px, all_lengths
        )
        span_m = _px_to_m(length_px)

        wall_list.append({
            "element_id":   f"W{idx:03d}",
            "start":        {"x": float(x1), "y": float(y1)},
            "end":          {"x": float(x2), "y": float(y2)},
            "length_px":    round(length_px, 2),
            "span_m":       span_m,
            "element_type": wall_type,
            "is_outer":     is_outer,
            "is_spine":     False,
        })

    # --- Mark central-spine candidates ---
    # Walls that are long, not outer, and roughly centred on both axes
    cx, cy = img_w / 2, img_h / 2
    spine_margin = 0.20   # within 20% of centre
    for w in wall_list:
        if w["element_type"] == "load_bearing_wall" and not w["is_outer"]:
            mx = (w["start"]["x"] + w["end"]["x"]) / 2
            my = (w["start"]["y"] + w["end"]["y"]) / 2
            if (abs(mx - cx) < img_w * spine_margin and
                    abs(my - cy) < img_h * spine_margin):
                w["is_spine"] = True

    print(f"Detected {len(wall_list)} walls "
          f"({sum(1 for w in wall_list if w['element_type']=='load_bearing_wall')} load-bearing, "
          f"{sum(1 for w in wall_list if w['element_type']=='partition_wall')} partition)")
    return wall_list
