import os
import re
import random
from concurrent.futures import ThreadPoolExecutor
from huggingface_hub import InferenceClient
from dotenv import load_dotenv
import os

load_dotenv()

client = InferenceClient(token=os.environ["HF_TOKEN"])

MODEL = "Qwen/Qwen2.5-72B-Instruct"

MAPILLARY_TOKEN = os.getenv("MAPILLARY_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT = (
    "You are an accessibility routing assistant for Montreal transit.\n\n"
    "You are given route options. Each route includes its legs (transit steps) and, "
    "for walking segments, data from a Montreal urban accessibility dataset with fields such as "
    "heat_class (urban heat island intensity), collisions, construction permits, "
    "road obstructions (entraves), and tree cover.\n\n"
    "Start your response with exactly one line containing only: RECOMMENDED:<id> "
    "where <id> is the integer route ID (e.g. RECOMMENDED:0 or RECOMMENDED:2). "
    "No extra words or punctuation on that line.\n"
    "Then evaluate every route provided using the labels "
    "'Recommended Route', 'Alternative 1', 'Alternative 2'.\n"
    "Do not use route ID numbers in the evaluation text.\n"
    "For each route, describe specific accessibility advantages and concerns for the user's mobility aid, "
    "drawing on the route legs and walk-segment data provided. DO NOT evaluate the route only by what is fastest\n"
    "Give a confidence level (Low/Medium/High) for your top recommendation\n"
    "Consider the date and season when assessing walking conditions.\n"
    "Do not invent information not in the data. If you cannot find good available data, say so. Be concise and practical, listing your recommendations in bullet point form so they are easy to read."
)

SKIP_POINT_KEYS = {"leg_from", "leg_to", "point_index", "lat", "lon"}


# ─────────────────────────────────────────────────────────────────────────────
# Gemini / Mapillary VLM scoring functions
# To disable: comment out the `gemini_scores = fetch_gemini_scores(points)` line
# in format_routes_for_llm(). The functions themselves are safe to leave in place.
# ─────────────────────────────────────────────────────────────────────────────

def _coord_key(lat, lon):
    """Normalise a lat/lon pair to 5 d.p. for consistent dict lookups."""
    return (round(float(lat), 5), round(float(lon), 5))


def _fetch_three_views(lat, lon, radius=20):
    """
    Fetch a Mapillary street-view image near (lat, lon) and return 3 PIL views.
    Prefers non-panoramic images; always produces 3 horizontal crops for
    consistent batch sizing (1 coord = 3 images).
    Returns [] if no image is found.
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
    resp = requests.get("https://graph.mapillary.com/images", params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    if not data:
        print(f"  Mapillary: no image within {radius}m of ({lat:.5f}, {lon:.5f})")
        return []
    img_meta = next((i for i in data if not i.get("is_pano", False)), data[0])
    url = img_meta.get("thumb_2048_url")
    if not url:
        return []
    img_resp = requests.get(url, timeout=15)
    img_resp.raise_for_status()
    img = Image.open(BytesIO(img_resp.content)).convert("RGB")
    img = img.resize((1024, 512))
    w, h = img.size
    views = [
        img.crop((0, 0, w // 3, h)),
        img.crop((w // 3, 0, 2 * w // 3, h)),
        img.crop((2 * w // 3, 0, w, h)),
    ]
    for v in views:
        v.thumbnail((512, 512), Image.Resampling.LANCZOS)
    return views


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


def fetch_gemini_scores(points, mobility_aid="no mobility aid"):
    """
    Score all points in `points` using Mapillary street-view images and Gemini.
    Fetches 3 views per point and calls Gemini once with the full batch.

    Returns a dict mapping _coord_key(lat, lon) -> {"score": int, "comments": str}
    where score is the average of the 3 per-view scores and comments concatenates
    the 3 per-view justification sentences.
    Returns {} if tokens are missing, packages unavailable, or no images fetched.
    """
    try:
        from google import genai as _genai
    except ImportError:
        print("google-genai not installed; skipping VLM scoring.")
        return {}, ""

    if not GEMINI_API_KEY or not MAPILLARY_TOKEN:
        print("GEMINI_API_KEY or MAPILLARY_TOKEN not set; skipping VLM scoring.")
        return {}, ""

    sample = list(points)

    def _fetch_point(p):
        lat, lon = p["lat"], p["lon"]
        print(f"  Fetching Mapillary image for ({lat:.5f}, {lon:.5f})")
        return [(lat, lon, v) for v in _fetch_three_views(lat, lon)]

    dataset = []  # list of (lat, lon, PIL.Image)
    with ThreadPoolExecutor(max_workers=8) as executor:
        for views in executor.map(_fetch_point, sample):
            dataset.extend(views)

    if not dataset:
        print("  No Mapillary images fetched; skipping Gemini call.")
        return {}, ""

    aid_criteria = MOBILITY_AID_CRITERIA.get(
        mobility_aid.lower(), MOBILITY_AID_CRITERIA["no mobility aid"]
    )

    # Build index -> (lat, lon) so we never rely on Gemini echoing coordinates accurately.
    idx_to_coord = {i + 1: (lat, lon) for i, (lat, lon, _) in enumerate(dataset)}
    image_labels = "\n".join(
        f"  Image {i + 1}: latitude={round(lat, 5)}, longitude={round(lon, 5)}"
        for i, (lat, lon, _) in enumerate(dataset)
    )
    prompt = (
        f"You are an urban accessibility analyst evaluating routes for {aid_criteria}\n\n"
        f"Below are {len(dataset)} street-level images.\n"
        f"The images are provided in this order:\n{image_labels}\n\n"
        "For each image, output exactly one line in this format:\n"
        "  <image_number>,<score>,<just>\n\n"
        "Where <image_number> is the integer shown above (1, 2, 3 …), "
        "<score> is an integer from 1 (very inaccessible) to 5 (fully accessible) "
        "for this specific user's mobility aid.\n"
        "<just> is a 1 sentence justification referencing the relevant features for this user. "
        "Do not use commas inside <just>."
    )

    gemini_client = _genai.Client(api_key=GEMINI_API_KEY)
    contents = [prompt] + [img for _, _, img in dataset]
    print(f"  Calling Gemini with {len(dataset)} images across {len(sample)} coordinates...")
    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
    )

    # Parse response lines: image_number,score,justification
    # Split on first 2 commas only so any remaining commas stay in justification text.
    raw_entries = {}  # _coord_key -> [(score, comment), ...]
    for line in response.text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(",", 2)
        if len(parts) < 3:
            print(f"  Could not parse Gemini line: {line}")
            continue
        try:
            img_num = int(parts[0])
            score = int(parts[1])
            comment = parts[2].strip()
        except ValueError:
            print(f"  Could not parse Gemini line: {line}")
            continue
        coord = idx_to_coord.get(img_num)
        if coord is None:
            print(f"  Unknown image index from Gemini: {img_num}")
            continue
        raw_entries.setdefault(_coord_key(*coord), []).append((score, comment))

    # Aggregate: average score across 3 views; concatenate the 3 justification sentences.
    result = {}
    for key, entries in raw_entries.items():
        avg_score = round(sum(s for s, _ in entries) / len(entries))
        combined_comments = " ".join(c for _, c in entries)
        result[key] = {"score": avg_score, "comments": combined_comments}

    print(f"  Gemini scored {len(result)} coordinates.")
    return result, response.text

# ── End Gemini / Mapillary functions ──────────────────────────────────────────


def _eligible_points(route):
    return [
        p for p in route.get("points", [])
        if any(
            k not in SKIP_POINT_KEYS and v is not None and str(v) != "nan"
            for k, v in p.items()
        )
    ]


def format_routes_for_llm(routes_data, disability_type="no mobility aid"):
    # Build per-route eligible lists and select 5 unique points per route for Gemini.
    route_eligible = []
    gemini_sample = []
    seen_coords = set()
    for route in routes_data[:3]:
        eligible = _eligible_points(route)
        route_eligible.append(eligible)
        shuffled = random.sample(eligible, len(eligible))
        added = 0
        for p in shuffled:
            if added >= 5:
                break
            key = _coord_key(p.get("lat"), p.get("lon"))
            if key not in seen_coords:
                seen_coords.add(key)
                gemini_sample.append(p)
                added += 1

    # ── Gemini VLM scoring: 5 unique points per route, all different ────────
    gemini_scores, gemini_raw = {}, []
   # gemini_scores, gemini_raw = fetch_gemini_scores(gemini_sample, disability_type)
    # ───────────────────────────────────────────────────────────────────────

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

        point_lines = []
        for p in eligible:
            coords = f"({p.get('lat'):.5f}, {p.get('lon'):.5f})"
            fields = " | ".join(
                f"{k}={v}" for k, v in p.items()
                if k not in SKIP_POINT_KEYS and v is not None and str(v) != "nan"
            )
            g_data = gemini_scores.get(_coord_key(p.get("lat"), p.get("lon")), {})
            g_score = str(g_data.get("score", "")) if g_data else ""
            g_comments = g_data.get("comments", "") if g_data else ""
            point_lines.append(
                f"  {coords} | {fields}"
                f" | gemini_accessibility_score={g_score}"
                f" | gemini_accessibility_comments={g_comments}"
            )
        point_text = "\n".join(point_lines) if point_lines else "  (no walk segment data)"

        blocks.append(
            f"=== Route {route['route_id']} ({dur_min} min, {transfers} transfer(s)) ===\n"
            f"Legs:\n{leg_text}\n\n"
            f"Walk segment data ({len(eligible)} eligible points):\n{point_text}"
        )
    return "\n\n".join(blocks), gemini_raw


def get_recommendation(origin, destination, disability_type, date, routes_data):
    for r in routes_data:
        modes = [l.get("mode") for l in r.get("legs", [])]
        print(f"  route {r.get('route_id')}: {modes}, {len(r.get('points', []))} pts")
    route_context, gemini_raw = format_routes_for_llm(routes_data, disability_type)

    user_prompt = (
        f"User profile:\n"
        f"- Origin: {origin}\n"
        f"- Destination: {destination}\n"
        f"- Mobility aid: {disability_type}\n"
        f"- Date: {date}\n\n"
        f"Routes:\n{route_context}\n\n"
        "Analyse the routes above and identify which is most accessible for this user."
    )

    with open("prompt_debug.txt", "w") as f:
        f.write("=== SYSTEM PROMPT ===\n")
        f.write(SYSTEM_PROMPT)
        f.write("\n\n=== USER PROMPT ===\n")
        f.write(user_prompt)
        if gemini_raw:
            f.write("\n\n=== GEMINI VLM RAW RESPONSE ===\n")
            f.write(gemini_raw)
    print("Prompts written to prompt_debug.txt")


    response = client.chat_completion(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=1024,
        temperature=0.2,
    )
    text = response.choices[0].message.content.strip()


    best_id = 0
    lines = text.split('\n')
    if lines[0].upper().lstrip().startswith('RECOMMENDED:'):
        m = re.search(r'\d+', lines[0].split(':', 1)[1])
        if m:
            candidate = int(m.group())
            if 0 <= candidate < len(routes_data):
                best_id = candidate
        text = '\n'.join(lines[1:]).strip()

    all_ids = list(range(len(routes_data)))
    ranked_ids = [best_id] + [i for i in all_ids if i != best_id]

    return {"text": text, "ranked_ids": ranked_ids}
