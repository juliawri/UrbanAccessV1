import os
import gradio as gr
from huggingface_hub import InferenceClient

with open("routes_with_accessibility.json", "r") as f:
    ROUTES_DATA = json.load(f)

client = InferenceClient(token=os.environ.get("HF_TOKEN"))


def format_routes_for_llm(routes_data, max_routes=3):
    blocks = []

    for route in routes_data[:max_routes]:
        route_id = route["route_id"]
        summary = route.get("summary", {})

        summary_text = "\n".join([
            f"- {k}: {v}" for k, v in summary.items()
        ])

        points = route.get("points", [])[:10]  # limit context size

        point_text = "\n".join([
            f"  ({p.get('lat'):.5f}, {p.get('lon'):.5f}) | "
            f"heat={p.get('heat_class')} | "
            f"dist={p.get('distance_to_access_m', 0):.1f}m"
            for p in points
        ])

        blocks.append(
            f"""Route {route_id}:
Summary:
{summary_text}

Sample points:
{point_text}
"""
        )

    return "\n\n".join(blocks)



STATION_INFO = {
    'Berri-UQAM': 'Elevator available. Accessible entrance on Berri St. Tactile strips present.',
    'McGill': 'Elevator under maintenance. Ramp available on McGill College Ave.',
    'Stop Sherbrooke / St-Denis': 'Standard bus stop. No shelter. Curb cut present.',
    'Stop McGill College / Sherbrooke': 'Bus stop with shelter. Level boarding platform.',
}

INCIDENTS = 'Icy sidewalk near Berri St (Jan 2025). Construction blocking curb cut on Ste-Catherine (ongoing).'

def get_route_context():
    return format_routes_for_llm(ROUTES_DATA)

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

def build_prompt(origin, destination, disability_type, date):
    #station_context = "\n".join([f"- {k}: {v}" for k, v in STATION_INFO.items()])
    route_context = get_route_context()

    return (
        f"User profile:\n"
        f"- Origin: {origin}\n"
        f"- Destination: {destination}\n"
        f"- Disability type: {disability_type}\n"
        f"- Date: {date}\n\n"
        #f"Station accessibility info:\n{station_context}\n\n"
        f"Route accessibility data (from GIS analysis):\n{route_context}\n\n"
        f"Sidewalk/crosswalk incidents:\n{INCIDENTS}\n\n"
        "Task:\n"
        "Rank the routes from most to least accessible and explain briefly why."
    )

def get_recommendation(origin, destination, disability_type, date):
    response = client.chat_completion(
        model="Qwen/Qwen2.5-72B-Instruct",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(origin, destination, disability_type, date)},
        ],
        max_tokens=1024,
    )
    return response.choices[0].message.content

demo = gr.Interface(
    fn=get_recommendation,
    inputs=[
        gr.Textbox(label="Origin", value="Plateau-Mont-Royal, Montreal"),
        gr.Textbox(label="Destination", value="McGill University, Montreal"),
        gr.Dropdown(
            choices=["wheelchair user", "visual impairment", "limited mobility", "hearing impairment"],
            label="Disability type",
            value="wheelchair user"
        ),
        gr.Textbox(label="Date", value="2025-01-15"),
    ],
    outputs=gr.Markdown(label="Route Recommendation"),
    title="Accessibility Route Advisor",
)

demo.launch()