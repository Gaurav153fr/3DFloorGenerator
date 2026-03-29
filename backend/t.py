import cv2
import numpy as np
import math

def detect_walls(image_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Using a threshold that captures thick wall lines
    _, mask = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return mask


def detect_gates(image_path):
    # 1. GET THE CLEAN MASK (Using your confirmed logic)
    img = cv2.imread(image_path)
    if img is None: return []
    h, w = img.shape[:2]
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                 cv2.THRESH_BINARY_INV, 11, 2)

    # Wall subtraction
    walls_mask = detect_walls(image_path)
    walls_mask_fat = cv2.dilate(walls_mask, np.ones((3,3), np.uint8), iterations=1)
    mask = cv2.subtract(mask, walls_mask_fat)

    # Line removal to isolate arcs
    for k_size in [5, 15]: 
        h_k = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, 1))
        v_k = cv2.getStructuringElement(cv2.MORPH_RECT, (1, k_size))
        lines = cv2.add(cv2.morphologyEx(mask, cv2.MORPH_OPEN, h_k),
                        cv2.morphologyEx(mask, cv2.MORPH_OPEN, v_k))
        mask = cv2.subtract(mask, cv2.dilate(lines, np.ones((3,3), np.uint8)))

    # Contour Analysis for Arcs
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    gates_data = []
    gate_idx = 1

    for c in cnts:
        area = cv2.contourArea(c)
        if area < 15: continue
        
        x, y, gw, gh = cv2.boundingRect(c)
        hull = cv2.convexHull(c)
        hull_area = cv2.contourArea(hull)
        solidity = float(area) / hull_area if hull_area > 0 else 0
        extent = float(area) / (gw * gh)

        # YOUR VALIDATION LOGIC
        if 0.2 < (float(gw)/gh) < 5.0 and solidity < 0.6 and extent < 0.5:
            
            # --- VECTORIZATION LOGIC ---
            if gw > gh:
                start_pt = {"x": int(x), "y": int(y + gh)}
                end_pt = {"x": int(x + gw), "y": int(y + gh)}
            else:
                start_pt = {"x": int(x), "y": int(y)}
                end_pt = {"x": int(x), "y": int(y + gh)}

            gates_data.append({
                "id": f"gate_{gate_idx}",
                "start": start_pt,
                "end": end_pt,
                "width": int(max(gw, gh))
            })
            gate_idx += 1

    return gates_data


def detect_gates_robust(image_path, headless=True):
    img = cv2.imread(image_path)
    if img is None: return None, []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. PRE-PROCESSING
    _, binary = cv2.threshold(gray, 210, 255, cv2.THRESH_BINARY_INV)
    walls = detect_walls(image_path) 
    wall_core = cv2.erode(walls, np.ones((3,3), np.uint8), iterations=1)
    details = cv2.subtract(binary, wall_core)

    # 2. HEALING & LINE REMOVAL
    blurred = cv2.GaussianBlur(details, (9, 9), 0)
    _, healed = cv2.threshold(blurred, 50, 255, cv2.THRESH_BINARY)
    h_k = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 1))
    v_k = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 20))
    lines = cv2.add(cv2.morphologyEx(healed, cv2.MORPH_OPEN, h_k),
                    cv2.morphologyEx(healed, cv2.MORPH_OPEN, v_k))
    arcs_only = cv2.subtract(healed, lines)

    # 3. CONTOUR FILTERING
    cnts, _ = cv2.findContours(arcs_only, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    final_gate_mask = np.zeros_like(gray)
    valid_contours = []

    for c in cnts:
        area = cv2.contourArea(c)
        if area < 50: continue
        x, y, w, h = cv2.boundingRect(c)
        hull = cv2.convexHull(c)
        solidity = area / cv2.contourArea(hull) if cv2.contourArea(hull) > 0 else 0
        if 0.3 < (float(w)/h) < 3.0 and solidity < 0.6:
            cv2.drawContours(final_gate_mask, [c], -1, 255, -1)
            valid_contours.append(c)

    # --- 4. ANCHOR POINT CALCULATION (JSON GENERATION) ---
    gate_json = []
    
    skeleton = manual_skeletonize(final_gate_mask)
    
    endpoints = []
    ys, xs = np.where(skeleton > 0)
    for y, x in zip(ys, xs):
        if y == 0 or x == 0 or y >= skeleton.shape[0]-1 or x >= skeleton.shape[1]-1: continue
        if np.sum(skeleton[y-1:y+2, x-1:x+2]) == 510:
            endpoints.append((int(x), int(y)))

    for i, c in enumerate(valid_contours):
        gate_ends = []
        for ep in endpoints:
            if cv2.pointPolygonTest(c, (float(ep[0]), float(ep[1])), False) >= 0:
                gate_ends.append(ep)
        
        if len(gate_ends) >= 2:
            p1, p2 = find_furthest_points(gate_ends)
            d1 = distance_to_nearest_wall(p1, walls)
            d2 = distance_to_nearest_wall(p2, walls)
            
            hinge, tip = (p1, p2) if d1 < d2 else (p2, p1)
            
            gate_json.append({
                "id": f"gate_{i+1}",
                "start": {"x": int(hinge[0]), "y": int(hinge[1])},
                "end": {"x": int(tip[0]), "y": int(tip[1])},
                "width": int(math.sqrt((hinge[0]-tip[0])**2 + (hinge[1]-tip[1])**2))
            })

    return final_gate_mask, gate_json


# --- HELPER FUNCTIONS ---

def manual_skeletonize(img):
    skel = np.zeros(img.shape, np.uint8)
    _, img = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3,3))
    temp = img.copy()
    while True:
        eroded = cv2.erode(temp, element)
        opening = cv2.dilate(eroded, element)
        opening = cv2.subtract(temp, opening)
        skel = cv2.bitwise_or(skel, opening)
        temp = eroded.copy()
        if cv2.countNonZero(temp) == 0: break
    return skel

def find_furthest_points(pts):
    max_d = -1
    best_pair = (pts[0], pts[-1])
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            d = (pts[i][0]-pts[j][0])**2 + (pts[i][1]-pts[j][1])**2
            if d > max_d:
                max_d = d
                best_pair = (pts[i], pts[j])
    return best_pair

def distance_to_nearest_wall(point, wall_mask):
    dist_map = cv2.distanceTransform(cv2.bitwise_not(wall_mask), cv2.DIST_L2, 3)
    return dist_map[int(point[1]), int(point[0])]


def detect_windows_json(image_path, headless=True):
    # 1. LOAD IMAGES
    img = cv2.imread(image_path)
    if img is None: return []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. MASK GENERATION
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 20))
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 1))
    v_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)
    h_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)
    
    thick_mask = detect_walls(image_path) 
    thick_mask_fat = cv2.dilate(thick_mask, np.ones((5,5), np.uint8), iterations=1)
    
    win_pixels = cv2.subtract(cv2.bitwise_or(v_lines, h_lines), thick_mask_fat)
    win_pixels = cv2.morphologyEx(win_pixels, cv2.MORPH_OPEN, np.ones((2,2), np.uint8))

    # 3. OUTER WALL FILTER
    cnts, _ = cv2.findContours(thick_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        outer_ribbon = np.zeros_like(win_pixels)
        main_shell = max(cnts, key=cv2.contourArea)
        cv2.drawContours(outer_ribbon, [main_shell], -1, 255, thickness=40)
        win_pixels = cv2.bitwise_and(win_pixels, outer_ribbon)

    # 4. BUILD A WALL-PROXIMITY MAP
    # Distance transform: for every pixel, distance to the nearest wall pixel.
    # Windows whose line (mid + endpoints) is too far from any wall are floating
    # false detections and must be discarded.
    wall_inv = cv2.bitwise_not(thick_mask)   # 0 = wall, 255 = non-wall
    dist_to_wall = cv2.distanceTransform(wall_inv, cv2.DIST_L2, 3)
    WALL_SNAP = 18  # px — max allowed distance from wall; tune if needed

    def _on_wall(px, py):
        """Return True when pixel (px, py) is within WALL_SNAP px of a wall."""
        px, py = int(round(px)), int(round(py))
        px = max(0, min(dist_to_wall.shape[1]-1, px))
        py = max(0, min(dist_to_wall.shape[0]-1, py))
        return dist_to_wall[py, px] <= WALL_SNAP

    # 5. VECTORIZE
    lines = cv2.HoughLinesP(win_pixels, 1, np.pi/180, 15, minLineLength=10, maxLineGap=5)
    
    windows_json = []
    win_idx = 1
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            
            # Snap to 90 degrees
            is_h = abs(y1 - y2) < abs(x1 - x2)
            if is_h: y2 = y1
            else: x2 = x1

            # --- FLOATING WINDOW FILTER ---
            # Midpoint AND both endpoints must be close to a real wall pixel.
            mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
            if not (_on_wall(mx, my) and _on_wall(x1, y1) and _on_wall(x2, y2)):
                continue  # floating — discard

            windows_json.append({
                "id": f"window_{win_idx}",
                "start": {"x": int(x1), "y": int(y1)},
                "end": {"x": int(x2), "y": int(y2)},
                "width": int(np.sqrt((x1-x2)**2 + (y1-y2)**2))
            })
            win_idx += 1

    return windows_json