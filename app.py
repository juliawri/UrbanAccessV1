import os
import json
from huggingface_hub import InferenceClient

client = InferenceClient(token=os.environ.get("HF_TOKEN"))

MODEL = "Qwen/Qwen2.5-72B-Instruct"

with open("routes_with_accessibility.json", "r") as f:
    ROUTES_DATA = json.load(f)

SYSTEM_PROMPT = (
    "You are an accessibility routing assistant for Montreal transit.\n\n"
    "Your task:\n"
    "1. Rank the routes from most to least accessible for the user's disability type.\n"
    "2. For each route, briefly note accessibility concerns or advantages.\n"
    "3. Give a confidence level (Low/Medium/High) for your top recommendation.\n"
    "4. Consider the date and season when assessing walking conditions.\n"
    "5. Do not invent information not provided. If data is missing, say so.\n"
    "6. Be concise and practical."
)


def format_routes_for_llm(routes_data, max_routes=3):
    blocks = []
    for route in routes_data[:max_routes]:
        route_id = route["route_id"]
        summary = route.get("summary", {})
        summary_text = "\n".join([f"- {k}: {v}" for k, v in summary.items()])
        points = route.get("points", [])[:10]
        point_text = "\n".join([
            f"  ({p.get('lat'):.5f}, {p.get('lon'):.5f}) | "
            f"heat={p.get('heat_class')} | "
            f"dist={p.get('distance_to_access_m', 0):.1f}m"
            for p in points
        ])
        blocks.append(f"Route {route_id}:\nSummary:\n{summary_text}\n\nSample points:\n{point_text}\n")
    return "\n\n".join(blocks)


def build_prompt(origin, destination, disability_type, date):
    route_context = format_routes_for_llm(ROUTES_DATA)
    return (
        f"User profile:\n"
        f"- Origin: {origin}\n"
        f"- Destination: {destination}\n"
        f"- Disability type: {disability_type}\n"
        f"- Date: {date}\n\n"
        f"Route accessibility data for walking segments:\n{route_context}\n\n"
        #f"Sidewalk/crosswalk incidents:\n{INCIDENTS}\n\n"
        "Task:\nRank the routes from most to least accessible and explain briefly why."
    )


def get_recommendation(origin, destination, disability_type, date):
    response = client.chat_completion(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(origin, destination, disability_type, date)},
        ],
        max_tokens=1024,
        temperature=0.2,
    )
    return response.choices[0].message.content
