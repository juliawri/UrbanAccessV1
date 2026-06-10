import os
import re
import random
from huggingface_hub import InferenceClient

client = InferenceClient(token=os.environ.get("HF_TOKEN"))

MODEL = "Qwen/Qwen2.5-72B-Instruct"

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


def format_routes_for_llm(routes_data):
    blocks = []
    for route in routes_data[:3]:
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

        all_points = route.get("points", [])
        eligible = [
            p for p in all_points
            if any(
                k not in SKIP_POINT_KEYS and v is not None and str(v) != "nan"
                for k, v in p.items()
            )
        ]
        points = random.sample(eligible, min(30, len(eligible)))
        print(points)
        point_lines = []
        for p in points:
            coords = f"({p.get('lat'):.5f}, {p.get('lon'):.5f})"
            fields = " | ".join(
                f"{k}={v}" for k, v in p.items()
                if k not in SKIP_POINT_KEYS and v is not None and str(v) != "nan"
            )
            point_lines.append(f"  {coords} | {fields}")
        point_text = "\n".join(point_lines) if point_lines else "  (no walk segment data)"

        blocks.append(
            f"=== Route {route['route_id']} ({dur_min} min, {transfers} transfer(s)) ===\n"
            f"Legs:\n{leg_text}\n\n"
            f"Walk segment data ({len(points)} of {len(eligible)} eligible points sampled):\n{point_text}"
        )
    return "\n\n".join(blocks)


def get_recommendation(origin, destination, disability_type, date, routes_data):
    for r in routes_data:
        modes = [l.get("mode") for l in r.get("legs", [])]
        print(f"  route {r.get('route_id')}: {modes}, {len(r.get('points', []))} pts")
    route_context = format_routes_for_llm(routes_data)

    user_prompt = (
        f"User profile:\n"
        f"- Origin: {origin}\n"
        f"- Destination: {destination}\n"
        f"- Mobility aid: {disability_type}\n"
        f"- Date: {date}\n\n"
        f"Routes:\n{route_context}\n\n"
        "Analyse the routes above and identify which is most accessible for this user."
    )

    print( f"User profile:\n")
    print(f"- Origin: {origin}\n")
    print(f"- Destination: {destination}\n")
    print(f"- Mobility aid: {disability_type}\n")
    print(f"- Date: {date}\n\n")
    print( f"Routes:\n{route_context}\n\n")
    print("Analyse the routes above and identify which is most accessible for this user.")


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
