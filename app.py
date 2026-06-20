import os
import re
import random
from concurrent.futures import ThreadPoolExecutor
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()

client = InferenceClient(token=os.getenv("HF_TOKEN"))

MODEL = "Qwen/Qwen2.5-72B-Instruct"

MAPILLARY_TOKEN = os.getenv("MAPILLARY_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT = (
    "You are an accessibility routing assistant for Montreal transit.\n\n"

    "You are given route options. Each route includes its legs (transit steps) and, "
    "for walking segments, data collected from the city and street-level photos.\n\n"

    "=== WHAT THE DATA MEANS (for your reasoning only — do not repeat field names or scores in your response) ===\n\n"

    "1. ENVIRONMENTAL CONDITIONS (per walk-segment point)\n"
    "   - heat_class (1–5): How hot this area gets. 1 = cool and shaded, 5 = intense urban heat. "
    "High heat is tiring and risky for people using mobility aids.\n"
    "   - num_collisions: How many pedestrian-vehicle incidents have happened near this spot. "
    "More incidents = more dangerous crossing.\n"
    "   - num_building_permits / num_permit_affected_homes / type_of_permit: Construction activity "
    "nearby. Construction often means temporary sidewalk closures, uneven ground, or debris.\n"
    "   - num_barriers / active_barriers / barriers_main_reason: Physical obstructions on the path. "
    "active_barriers > 0 means something is currently blocking or narrowing the sidewalk.\n"
    "   - num_trees / trees_main_type / average_tree_size_from_trunk_diam_cm: Tree coverage. "
    "More large trees = more shade and cooler walking conditions, but very large roots can "
    "create uneven pavement.\n\n"

    "2. STREET PHOTO ANALYSIS (mae_inaccessible_prob)\n"
    "   AI analysis of street-level photos to spot physical barriers for the user's mobility aid. "
    "Score is 0.0 to 1.0 — higher means more likely to be difficult or impassable:\n"
    "   - 0.0–0.3: Path looks clear — smooth surface, no visible obstacles.\n"
    "   - 0.3–0.6: Some potential issues — minor obstacles or surfaces that may be hard to navigate.\n"
    "   - 0.6–1.0: Likely problem — things like missing curb cuts, broken pavement, narrow paths, "
    "steep cross-slopes, or missing ramps were detected.\n"
    "   Weight this heavily. Multiple high-concern points on one route is a serious red flag.\n\n"

    "3. DETAILED PHOTO REVIEW (gemini_accessibility_score, gemini_accessibility_comments)\n"
    "   A closer look at the most concerning spots across all routes using additional photo review. "
    "Score is 0–4: 0–1 = very difficult, 3 = manageable with effort, 3–4 = accessible. "
    "The comments describe what was found (e.g. 'missing curb cut', 'cracked pavement'). "
    "When both photo analyses agree a spot is difficult, that's a strong warning sign.\n\n"

    "=== HOW TO DECIDE ===\n\n"
    "Use this priority order when comparing routes:\n"
    "  1. CONFIRMED BLOCKAGES (active_barriers > 0): Something is actively blocking the path right now — highest concern.\n"
    "  2. MULTIPLE HIGH-CONCERN PHOTO SPOTS: Several points where photos show clear barriers — strong evidence of difficulty.\n"
    "  3. MODERATE PHOTO CONCERNS: A few spots with potential issues — worth flagging, but not necessarily a dealbreaker.\n"
    "  4. ENVIRONMENTAL RISKS: High collision history, active construction, and intense heat are important context.\n"
    "  5. SHADE AND COMFORT: Prefer routes with more shade when other factors are similar, especially in hot weather.\n"
    "  6. PAST USER FEEDBACK: If a 'PAST USER FEEDBACK' section is present in the user message, factor it in "
    "proportionally to its stated relevance level. CRITICAL RELEVANCE feedback should influence your recommendation "
    "significantly; LOW RELEVANCE feedback should only add minor context. Always mention relevant past feedback "
    "in the Summary field of the affected route.\n\n"

    "=== OUTPUT FORMAT ===\n\n"
    "Your response MUST follow this exact structure. Every section header must appear verbatim "
    "for all three routes so that automated tools can parse the output reliably.\n\n"

    "Line 1 — recommendation tag (required, nothing else on this line):\n"
    "RECOMMENDED:<id>\n"
    "(where <id> is the integer route ID, e.g. RECOMMENDED:2)\n\n"

    "Then repeat the following block EXACTLY three times — once for each route — "
    "using the labels 'Recommended Route', 'Alternative 1', 'Alternative 2' in that order "
    "(the recommended route always appears first, regardless of its original position):\n\n"

    "## <label>\n"
    "**Active Blockages:** <one sentence — state whether anything is currently blocking or narrowing "
    "the path, or 'None detected.'>\n"
    "**Street Photos:** <one sentence — describe what street-level photos suggest about path condition, "
    "or 'No photo data available.'>\n"
    "**Detailed Photo Review:** <one sentence — describe what the closer photo review found, "
    "or 'No detailed photo data available.'>\n"
    "**Traffic Safety:** <one sentence — describe collision history near this route.>\n"
    "**Construction:** <one sentence — describe any nearby building permits or construction activity, "
    "or 'No construction activity detected.'>\n"
    "**Heat & Shade:** <one sentence — describe how hot this route tends to get and how much tree cover there is.>\n"
    "**Summary:** <one or two sentences — overall accessibility verdict for this route.>\n\n"

    "After all three route blocks, add:\n"
    "**Confidence:** <High / Medium / Low> — <two sentences explaining why, "
    "noting whether photo data was available and what the main limiting factor was. Do NOT mention any route names, route numbers, or transit line numbers here.>\n\n"

    "STRICT RULES:\n"
    "- Every header (**Active Blockages:**, **Street Photos:**, etc.) must appear for every route.\n"
    "- Do NOT use route ID numbers (0, 1, 2) anywhere in the evaluation text.\n"
    "- The **Confidence:** line must describe data quality only — do NOT reference route names, route labels, "
    "transit line numbers, or any identifier that distinguishes one route from another.\n"
    "- Do NOT mention scores, probabilities, field names, or model names. "
    "Use plain language a non-technical reader would understand.\n"
    "- Do NOT evaluate routes solely by travel time.\n"
    "- Do not invent information not in the data. "
    "If a factor has no data, write exactly 'No data available.' for that field.\n"
    "- Consider the date and season when assessing walking conditions.\n"
    "- No extra sections, headers, or freeform paragraphs outside this structure."
)

SKIP_POINT_KEYS = {"leg_from", "leg_to", "point_index", "lat", "lon"}

# Max unique coordinates to fetch Mapillary images for across all routes.
MAX_IMAGE_COORDS = 50
# Number of most-inaccessible images (by MAE confidence) forwarded to Gemini.
GEMINI_IMAGE_BUDGET = 15


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _coord_key(lat, lon):
    return (round(float(lat), 5), round(float(lon), 5))


def _eligible_points(route):
    return [
        p for p in route.get("points", [])
        if any(
            k not in SKIP_POINT_KEYS and v is not None and str(v) != "nan"
            for k, v in p.items()
        )
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Mapillary image fetching
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_three_views(lat, lon, radius=20):
    """
    Fetch a Mapillary image near (lat, lon) and return 3 horizontal PIL crops.
    Returns [] if no image is found or fetch fails.
    """
    import requests
    from io import BytesIO
    from PIL import Image

    params = {
        "lat": lat,
        "lng": lon,
        "radius": radius,
        "limit": 16,
        "fields": "id,thumb_2048_url,is_pano,geometry",
        "access_token": MAPILLARY_TOKEN,
    }
    try:
        resp = requests.get("https://graph.mapillary.com/images", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json().get("data", [])
    except Exception as e:
        print(f"[mapillary] ERROR fetching image at ({lat:.5f}, {lon:.5f}): {str(e)[:80]}")
        return []

    if not data:
        print(f"[mapillary] No image found within {radius}m of ({lat:.5f}, {lon:.5f}) — skipping coordinate")
        return []

    img_meta = next((i for i in data if not i.get("is_pano", False)), data[0])
    url = img_meta.get("thumb_2048_url")
    if not url:
        return []

    try:
        img_resp = requests.get(url, timeout=15)
        img_resp.raise_for_status()
        img = Image.open(BytesIO(img_resp.content)).convert("RGB")
    except Exception as e:
        print(f"[mapillary] ERROR downloading image at ({lat:.5f}, {lon:.5f}): {str(e)[:80]}")
        return []

    img = img.resize((1024, 512))
    w, h = img.size
    views = [
        img.crop((0,          0, w // 3,     h)),
        img.crop((w // 3,     0, 2 * w // 3, h)),
        img.crop((2 * w // 3, 0, w,           h)),
    ]
    for v in views:
        v.thumbnail((512, 512), Image.Resampling.LANCZOS)
    return views


def fetch_all_images(points):
    """
    Fetch Mapillary images for all points in parallel.

    Args:
        points: list of dicts with 'lat' and 'lon' keys

    Returns:
        list of (lat, lon, PIL.Image) — one tuple per view (up to 3 per point).
        Points with no image are omitted.
    """
    def _fetch_point(p):
        lat, lon = p["lat"], p["lon"]
        print(f"[mapillary] Fetching street-level images at ({lat:.5f}, {lon:.5f})")
        views = _fetch_three_views(lat, lon)
        return [(lat, lon, v) for v in views]

    dataset = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        for views in executor.map(_fetch_point, points):
            dataset.extend(views)
    return dataset


# ─────────────────────────────────────────────────────────────────────────────
# MAE vision transformer scoring
# ─────────────────────────────────────────────────────────────────────────────

def run_mae_scoring(dataset, disability_type):
    """
    Run the MAE fine-tuned model over all images.

    Args:
        dataset:         list of (lat, lon, PIL.Image)
        disability_type: string forwarded to mae_inference.score_images

    Returns:
        scores: list[float] — inaccessible probability per image (same order as dataset)
        coord_scores: dict mapping _coord_key(lat,lon) -> mean inaccessible probability
    """
    try:
        import mae_inference
    except ImportError:
        print("[vit] ViT inference module not available — skipping accessibility vision scoring")
        return [0.0] * len(dataset), {}

    images = [img for _, _, img in dataset]
    print(f"[vit] Running ViT accessibility model on {len(images)} street-level images…")
    scores = mae_inference.score_images(images, disability_type)

    # Aggregate per coordinate (mean over 3 views)
    coord_accum = {}
    for (lat, lon, _), score in zip(dataset, scores):
        key = _coord_key(lat, lon)
        coord_accum.setdefault(key, []).append(score)
    coord_scores = {k: sum(v) / len(v) for k, v in coord_accum.items()}

    print(f"[vit] Scored {len(coord_scores)} unique coordinates with inaccessibility probabilities")
    return scores, coord_scores


# ─────────────────────────────────────────────────────────────────────────────
# Gemini VLM scoring (accepts pre-fetched images)
# ─────────────────────────────────────────────────────────────────────────────

MOBILITY_AID_CRITERIA = {
    "manual wheelchair": (
        "a manual wheelchair user. Focus on: kerb cuts and ramp availability, pavement smoothness, "
        "cross-slopes, obstacles blocking the path, and minimum clear width (≥90 cm)."
    ),
    "electric wheelchair": (
        "an electric wheelchair user. Focus on: kerb cuts and ramps, pavement smoothness and firmness, "
        "steep inclines or cross-slopes, path width (≥120 cm preferred), and overhead clearance."
    ),
    "mobility scooter": (
        "a mobility scooter user. Focus on: kerb cuts, wide turning radius requirements, pavement "
        "smoothness, steep slopes, path width (≥150 cm preferred), and surface stability."
    ),
    "walker": (
        "a walker (rollator) user. Focus on: pavement evenness, kerb cuts, obstacles, surface "
        "grip/traction, and avoiding uneven or loose surfaces."
    ),
    "walking cane": (
        "a walking cane user. Focus on: pavement evenness, trip hazards, surface grip/traction, "
        "kerb drops, and icy or slippery surfaces."
    ),
    "no mobility aid": (
        "a pedestrian with no mobility aid. Focus on: general pavement condition, obstacles, "
        "and pedestrian safety."
    ),
}


def fetch_gemini_scores(dataset, mobility_aid="no mobility aid"):
    """
    Score a pre-fetched image batch using Gemini VLM.

    Args:
        dataset:      list of (lat, lon, PIL.Image) — the images to score
        mobility_aid: disability type string

    Returns:
        (gemini_scores, raw_text, error_str)
        gemini_scores: dict mapping _coord_key(lat,lon) -> {"score": int, "comments": str}
    """
    try:
        from google import genai as _genai
    except ImportError:
        print("[gemini] google-genai package not installed — skipping Gemini vision analysis")
        return {}, "", "google-genai package not installed"

    if not GEMINI_API_KEY or not MAPILLARY_TOKEN:
        print("[gemini] Missing GEMINI_API_KEY or MAPILLARY_TOKEN — skipping Gemini vision analysis")
        return {}, "", "GEMINI_API_KEY or MAPILLARY_TOKEN not set"

    if not dataset:
        print("[gemini] No images in dataset — skipping vision analysis")
        return {}, "", "No images provided"

    aid_criteria = MOBILITY_AID_CRITERIA.get(
        mobility_aid.lower(), MOBILITY_AID_CRITERIA["no mobility aid"]
    )

    idx_to_coord = {i + 1: (lat, lon) for i, (lat, lon, _) in enumerate(dataset)}
    image_labels = "\n".join(
        f"  Image {i + 1}: latitude={round(lat, 5)}, longitude={round(lon, 5)}"
        for i, (lat, lon, _) in enumerate(dataset)
    )
    prompt = (
        f"You are an urban accessibility analyst evaluating routes for {aid_criteria}\n\n"
        f"Below are {len(dataset)} street-level images selected as the most potentially "
        f"inaccessible locations on these routes.\n"
        f"The images are provided in this order:\n{image_labels}\n\n"
        "For each image, output exactly one line in this format:\n"
        "  <image_number>,<score>,<just>\n\n"
        "Where <image_number> is the integer shown above (1, 2, 3 …), "
        "<score> is an integer from 1 (very inaccessible) to 5 (fully accessible) "
        "for this specific user's mobility aid.\n"
        "<just> is a 1 sentence justification referencing the relevant features for this user. "
        "Do not use commas inside <just>."
    )

    gemini_client = _genai.Client(
        api_key=GEMINI_API_KEY,
        http_options={"timeout": 30},
    )

    contents = [prompt] + [img for _, _, img in dataset]
    n_coords = len(set(_coord_key(lat, lon) for lat, lon, _ in dataset))
    print(f"[gemini] Sending {len(dataset)} street images across {n_coords} coordinates for accessibility scoring…")

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
        )
    except Exception as e:
        print(f"[gemini] ERROR: API call failed — {str(e)[:100]}")
        return {}, "", f"Gemini API call failed: {e}"

    raw_entries = {}
    for line in response.text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(",", 2)
        if len(parts) < 3:
            print(f"[gemini] Could not parse response line: {line[:80]!r}")
            continue
        try:
            img_num = int(parts[0])
            score = round(float(parts[1]))
            comment = parts[2].strip()
        except ValueError:
            print(f"[gemini] Could not parse response line: {line[:80]!r}")
            continue
        coord = idx_to_coord.get(img_num)
        if coord is None:
            print(f"[gemini] Response referenced unknown image index {img_num} — ignoring")
            continue
        raw_entries.setdefault(_coord_key(*coord), []).append((score, comment))

    result = {}
    for key, entries in raw_entries.items():
        avg_score = round(sum(s for s, _ in entries) / len(entries))
        combined_comments = " ".join(c for _, c in entries)
        result[key] = {"score": avg_score, "comments": combined_comments}

    print(f"[gemini] Done — accessibility scores returned for {len(result)} unique coordinates")
    return result, response.text, None


# ─────────────────────────────────────────────────────────────────────────────
# Main pipeline: MAE → select top 15 → Gemini
# ─────────────────────────────────────────────────────────────────────────────

def run_image_pipeline(all_points, disability_type):
    """
    Full image-based scoring pipeline:
      1. Fetch Mapillary images for all unique points (parallel).
      2. Run all images through the MAE model → inaccessible probability.
      3. Select the GEMINI_IMAGE_BUDGET images with highest inaccessible confidence.
      4. Pass those to Gemini VLM for detailed accessibility scoring.

    Args:
        all_points:      list of point dicts with 'lat' and 'lon'
        disability_type: string (e.g. "manual wheelchair")

    Returns:
        mae_coord_scores:  dict _coord_key -> mean inaccessible probability (float)
        gemini_scores:     dict _coord_key -> {"score": int, "comments": str}
        gemini_raw:        raw Gemini response text
        gemini_error:      error string or None
    """
    if not all_points:
        return {}, {}, "", "No points provided"

    # 1. Fetch all images
    dataset = fetch_all_images(all_points)
    if not dataset:
        return {}, {}, "", "No Mapillary images fetched"

    # 2. MAE scoring
    mae_scores_per_image, mae_coord_scores = run_mae_scoring(dataset, disability_type)

    # 3. Select top GEMINI_IMAGE_BUDGET images by inaccessible confidence
    ranked = sorted(
        zip(mae_scores_per_image, dataset),
        key=lambda x: x[0],
        reverse=True,
    )
    gemini_dataset = [item for _, item in ranked[:GEMINI_IMAGE_BUDGET]]
    conf_hi = ranked[0][0]
    conf_lo = ranked[min(GEMINI_IMAGE_BUDGET - 1, len(ranked) - 1)][0]
    print(f"[pipeline] Top {len(gemini_dataset)} most-inaccessible images selected for Gemini (confidence range: {conf_hi:.3f}–{conf_lo:.3f})")

    # 4. Gemini VLM scoring on selected images
    gemini_scores, gemini_raw, gemini_error = fetch_gemini_scores(gemini_dataset, disability_type)

    return mae_coord_scores, gemini_scores, gemini_raw, gemini_error


# ─────────────────────────────────────────────────────────────────────────────
# LLM context formatting
# ─────────────────────────────────────────────────────────────────────────────

def format_routes_for_llm(routes_data, disability_type="no mobility aid", fast_mode=False):
    fast_label = "ON — image pipeline skipped" if fast_mode else "OFF — full image pipeline will run"
    print(f"[pipeline] Starting route analysis | disability type: {disability_type!r} | fast mode: {fast_label}")
    # Collect unique eligible points across all routes (capped at MAX_IMAGE_COORDS)
    # Points are interleaved round-robin across routes so each route contributes
    # equally rather than earlier routes monopolising the cap.
    all_points = []
    seen_coords = set()
    route_eligible = []
    for route in routes_data[:3]:
        eligible = _eligible_points(route)
        route_eligible.append(eligible)
        print(f"[pipeline] Route {route.get('route_id')}: {len(eligible)} eligible walk segment points found for image analysis")

    # Stride-sample each route so images are spread evenly along its full length
    # rather than front-loaded. Per-route budget = cap / n_routes.
    n_routes = len(route_eligible)
    per_route_budget = max(1, MAX_IMAGE_COORDS // n_routes) if n_routes else MAX_IMAGE_COORDS
    iters = []
    for pts in route_eligible:
        valid = [p for p in pts if p.get("lat") is not None and p.get("lon") is not None]
        step = max(1, len(valid) // per_route_budget)
        iters.append(iter(valid[::step]))
    active = list(range(len(iters)))
    nexts = [next(it, None) for it in iters]
    while active and len(all_points) < MAX_IMAGE_COORDS:
        still_active = []
        for idx in active:
            p = nexts[idx]
            if p is None:
                continue
            key = _coord_key(p["lat"], p["lon"])
            if key not in seen_coords:
                seen_coords.add(key)
                all_points.append(p)
            nexts[idx] = next(iters[idx], None)
            if nexts[idx] is not None:
                still_active.append(idx)
            if len(all_points) >= MAX_IMAGE_COORDS:
                break
        active = still_active

    print(f"[pipeline] {len(all_points)} unique coordinates queued for Mapillary image fetching (round-robin across {len(route_eligible)} routes, cap: {MAX_IMAGE_COORDS})")

    if fast_mode:
        print("[pipeline] Fast mode enabled — skipping Mapillary, ViT, and Gemini image analysis")
        mae_coord_scores, gemini_scores, gemini_raw, gemini_error = {}, {}, "", None
    else:
        # Run the full image pipeline: Mapillary → MAE → top-15 → Gemini
        mae_coord_scores, gemini_scores, gemini_raw, gemini_error = run_image_pipeline(
            all_points, disability_type
        )

    # Build per-route text blocks.
    # Gemini-scored points are always included; non-Gemini points are randomly
    # sampled up to max_other_per_route. If the result exceeds MAX_CHARS we
    # halve max_other_per_route and rebuild until it fits (or max_other == 0).
    MAX_CHARS = 17_000
    MAX_POINTS = 10  # initial cap on non-Gemini points per route

    def _build_route_blocks(max_other_per_route):
        blocks = []
        for route, eligible in zip(routes_data[:3], route_eligible):
            dur_min = round(route.get("duration_sec", 0) / 60)
            transfers = route.get("transfers", 0)

            legs = route.get("legs", [])
            leg_lines = []
            for i, l in enumerate(legs, 1):
                l_dur = round(l.get("duration_sec", 0) / 60)
                l_dist = round(l.get("distance_m", 0))
                route_label = l.get("route") or ""
                name = f"{l.get('mode','?')}" + (f" ({route_label})" if route_label else "")
                leg_lines.append(
                    f"  {i}. {name}: {l.get('from','?')} → {l.get('to','?')}"
                    f" | {l_dur} min, {l_dist} m"
                )
            leg_text = "\n".join(leg_lines) if leg_lines else "  (no leg data)"

            # Always keep points that were scored by Gemini; randomly sample the rest
            gemini_pts = [
                p for p in eligible
                if p.get("lat") is not None and p.get("lon") is not None
                and _coord_key(p["lat"], p["lon"]) in gemini_scores
            ]
            other_pts = [
                p for p in eligible
                if p.get("lat") is not None and p.get("lon") is not None
                and _coord_key(p["lat"], p["lon"]) not in gemini_scores
            ]
            sampled_others = random.sample(other_pts, min(max_other_per_route, len(other_pts)))
            display_points = gemini_pts + sampled_others

            point_lines = []
            for p in display_points:
                if p.get("lat") is None or p.get("lon") is None:
                    continue
                coords = f"({p['lat']:.5f}, {p['lon']:.5f})"
                fields = " | ".join(
                    f"{k}={v}" for k, v in p.items()
                    if k not in SKIP_POINT_KEYS and v is not None and str(v) != "nan"
                )
                key = _coord_key(p["lat"], p["lon"])

                mae_data = mae_coord_scores.get(key)
                mae_suffix = (
                    f" | mae_inaccessible_prob={mae_data:.3f}"
                    if mae_data is not None else ""
                )

                g_data = gemini_scores.get(key, {})
                gemini_suffix = (
                    f" | gemini_accessibility_score={g_data['score']}"
                    f" | gemini_accessibility_comments={g_data['comments']}"
                    if g_data else ""
                )

                point_lines.append(f"  {coords} | {fields}{mae_suffix}{gemini_suffix}")

            point_text = "\n".join(point_lines) if point_lines else "  (no walk segment data)"
            sampled_note = (
                f" (showing {len(display_points)} of {len(eligible)})"
                if len(eligible) > len(display_points) else ""
            )

            blocks.append(
                f"=== Route {route['route_id']} ({dur_min} min, {transfers} transfer(s)) ===\n"
                f"Legs:\n{leg_text}\n\n"
                f"Walk segment data ({len(eligible)} eligible points{sampled_note}):\n{point_text}"
            )
        return blocks

    max_other = MAX_POINTS
    while True:
        blocks = _build_route_blocks(max_other)
        result = "\n\n".join(blocks)
        if len(result) <= MAX_CHARS or max_other == 0:
            break
        max_other = max(0, max_other // 2)
        print(f"[llm] Context too long ({len(result)} chars > {MAX_CHARS} limit) — reducing to {max_other} non-Gemini points per route")

    return result, gemini_raw, gemini_error


# ─────────────────────────────────────────────────────────────────────────────
# HuggingFace LLM recommendation
# ─────────────────────────────────────────────────────────────────────────────

def get_recommendation(origin, destination, disability_type, date, routes_data, fast_mode=False, similar_routes=None, language="en"):
    for r in routes_data:
        modes = [l.get("mode") for l in r.get("legs", [])]
        print(f"[llm] Route {r.get('route_id')}: modes={modes}, {len(r.get('points', []))} total points")

    route_context, gemini_raw, gemini_error = format_routes_for_llm(routes_data, disability_type, fast_mode=fast_mode)

    user_prompt = (
        f"User profile:\n"
        f"- Origin: {origin}\n"
        f"- Destination: {destination}\n"
        f"- Mobility aid: {disability_type}\n"
        f"- Date: {date}\n\n"
        f"Routes:\n{route_context}\n\n"
        "Analyse the routes above and identify which is most accessible for this user."
    )

    if similar_routes:
        sections = []
        for i, (similar, score) in enumerate(similar_routes, 1):
            if score >= 0.9:
                weight_label = "CRITICAL RELEVANCE"
                weight_instruction = (
                    "This feedback is from a nearly identical route — treat the user's past "
                    "experience as strong evidence and weight it very heavily."
                )
            elif score >= 0.7:
                weight_label = "HIGH RELEVANCE"
                weight_instruction = (
                    "This feedback is from a very similar route and should meaningfully "
                    "influence your recommendation."
                )
            elif score >= 0.5:
                weight_label = "MODERATE RELEVANCE"
                weight_instruction = (
                    "This feedback is from a moderately similar route — consider it alongside "
                    "the current route data, but don't let it override clear evidence."
                )
            else:
                weight_label = "LOW RELEVANCE"
                weight_instruction = (
                    "This feedback is from a loosely similar route — treat it as background "
                    "context only, not a primary factor."
                )

            parts = [f"Rating: {similar['rating']}/5"]
            if similar.get("comment"):
                parts.append(f"User comment: {similar['comment']}")
            if similar.get("disability_type"):
                parts.append(f"Mobility aid: {similar['disability_type']}")
            if similar.get("route_total_min"):
                parts.append(f"Duration: {similar['route_total_min']} min")
            if similar.get("route_num_transfers") is not None:
                parts.append(f"Transfers: {similar['route_num_transfers']}")
            if similar.get("route_legs_summary"):
                parts.append(f"Route: {similar['route_legs_summary']}")
            context = "\n".join(f"  - {p}" for p in parts)
            sections.append(
                f"[Feedback #{i} — {weight_label} — similarity {score:.2f}/1.00]\n"
                f"{weight_instruction}\n"
                f"{context}"
            )

        user_prompt += (
            f"\n\n"
            f"=== PAST USER FEEDBACK ({len(similar_routes)} match(es), ordered closest to furthest) ===\n"
            f"Weight each entry by its relevance label. Feedback #1 is the closest geographic match "
            f"and should carry the most influence; later entries are progressively less similar and "
            f"should be weighted accordingly. If entries conflict, prefer the higher-priority one.\n\n"
            + "\n\n".join(sections)
            + "\n=== END PAST USER FEEDBACK ==="
        )

    if language == "fr":
        user_prompt += (
            "\n\nIMPORTANT: Respond entirely in French. You MUST keep ALL of the following structural "
            "markers in English exactly as written so that automated parsing works correctly:\n"
            "- Section headers: '## Recommended Route', '## Alternative 1', '## Alternative 2'\n"
            "- The confidence line: '**Confidence:**'\n"
            "- ALL field labels: '**Active Blockages:**', '**Street Photos:**', '**Detailed Photo Review:**', "
            "'**Traffic Safety:**', '**Construction:**', '**Heat & Shade:**', '**Summary:**'\n"
            "Only the VALUES after each field label and the confidence explanation should be written in French. "
            "Do NOT translate the field labels themselves — they must remain in English exactly as shown."
        )

    print("=== SYSTEM PROMPT ===")
    print(SYSTEM_PROMPT)
    print("\n=== USER PROMPT ===")
    print(user_prompt)
    if gemini_error:
        print(f"\n=== GEMINI VLM STATUS: FAILED ===\n{gemini_error}")
    elif gemini_raw:
        print("\n=== GEMINI VLM STATUS: OK ===")
        print("\n=== GEMINI VLM RAW RESPONSE ===")
        print(gemini_raw)

    print(f"[llm] Sending request to HuggingFace — model={MODEL}, prompt_chars={len(user_prompt)}")
    try:
        response = client.chat_completion(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1024,
            temperature=0.2,
        )
    except Exception as e:
        print(f"[llm] ERROR: HuggingFace inference call failed — {str(e)[:100]}")
        return {"text": f"Model unavailable: {e}", "ranked_ids": list(range(len(routes_data)))}

    if not response.choices:
        return {"text": "No response from model.", "ranked_ids": list(range(len(routes_data)))}

    text = response.choices[0].message.content.strip()
    print(f"[llm] HuggingFace response received — {len(text)} chars, recommending route for {len(routes_data)} options")

    best_id = 0
    lines = text.split('\n')
    if lines[0].upper().lstrip().startswith('RECOMMENDED:'):
        m = re.fullmatch(r'\s*(\d+)\s*', lines[0].split(':', 1)[1])
        if m:
            candidate = int(m.group(1))
            if 0 <= candidate < len(routes_data):
                best_id = candidate
            else:
                print(f"[llm] RECOMMENDED route id {candidate} is out of range ({len(routes_data)} routes) — defaulting to route 0")
        else:
            print(f"[llm] Could not parse RECOMMENDED line: {lines[0][:80]!r} — defaulting to route 0")
        text = '\n'.join(lines[1:]).strip()

    all_ids = list(range(len(routes_data)))
    ranked_ids = [best_id] + [i for i in all_ids if i != best_id]

    return {"text": text, "ranked_ids": ranked_ids}
