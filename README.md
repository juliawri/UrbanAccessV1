# UrbanAccess — Accessibility Route Planner for Montreal

A transit routing app that recommends the most accessible route between two points in Montreal based on mobility aid type, using OpenTripPlanner for routing and an AI model for accessibility analysis.

---

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (~1.5GB)
- ~4GB free disk space (for containers + data files)
- A [HuggingFace token](https://huggingface.co/settings/tokens) (free account)
- [Git LFS](https://git-lfs.com) installed

---

## Setup

**1. Clone the repo and pull large files**
```bash
git clone https://github.com/juliawri/UrbanAccessV1
cd UrbanAccessV1
git lfs pull
```

**2. Set your HuggingFace token**
```bash
cp .env.example .env
# Open .env and replace hf_your_token_here with your actual token
```

**3. Start the app**
```bash
docker-compose up
```

First run takes **5–10 minutes** — OTP is building the Montreal routing graph from the data files. Subsequent starts are faster.

**4. Open your browser**
```
http://localhost:8000
```

---

## How to use

1. Select your mobility aid and date
2. Click your **origin** on the map
3. Click your **destination**
4. Wait for the AI recommendation (~10–20 sec)
5. Rate the suggested route using the feedback form

View all feedback submissions at `http://localhost:8000/feedback`

---

## Running without Docker (local dev)

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
```

Set your token and start:
```bash
$env:HF_TOKEN="hf_..."        # Windows PowerShell
export HF_TOKEN="hf_..."      # Mac/Linux
uvicorn main:app --reload
```

> Note: you'll also need PostgreSQL and OTP running locally. Docker is strongly recommended.
