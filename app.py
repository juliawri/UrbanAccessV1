import os
import gradio as gr
from huggingface_hub import InferenceClient

client = InferenceClient(token=os.environ.get("HF_TOKEN"))

STATION_INFO = {
    'Berri-UQAM': 'Elevator available. Accessible entrance on Berri St. Tactile strips present.',
    'McGill': 'Elevator under maintenance. Ramp available on McGill College Ave.',
    'Stop Sherbrooke / St-Denis': 'Standard bus stop. No shelter. Curb cut present.',
    'Stop McGill College / Sherbrooke': 'Bus stop with shelter. Level boarding platform.',
}

INCIDENTS = 'Icy sidewalk near Berri St (Jan 2025). Construction blocking curb cut on Ste-Catherine (ongoing).'

SAMPLE_PATHS = """
Path 1:
- Walk 5 min (near Berri St)
- Metro Green line: board at Berri-UQAM, exit at McGill
- Walk 3 min (near McGill College Ave)

Path 2:
- Walk 8 min (near Sherbrooke / St-Denis)
- Bus line 24: board at Stop Sherbrooke / St-Denis, exit at Stop McGill College / Sherbrooke
- Walk 2 min (near McGill College Ave)
"""

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
    station_context = "\n".join([f"- {k}: {v}" for k, v in STATION_INFO.items()])
    return (
        f"User profile:\n"
        f"- Origin: {origin}\n"
        f"- Destination: {destination}\n"
        f"- Disability type: {disability_type}\n"
        f"- Date: {date}\n\n"
        f"Station accessibility info:\n{station_context}\n\n"
        f"Sidewalk/crosswalk incidents:\n{INCIDENTS}\n\n"
        f"Available paths:\n{SAMPLE_PATHS}\n\n"
        "Please rank these paths and recommend the best one for this user."
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