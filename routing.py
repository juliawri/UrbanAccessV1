import requests

OTP_BASE_URL = "http://localhost:8080/otp/routers/default/plan"

def get_routes(from_lat, from_lon, to_lat, to_lon, modes="WALK,TRANSIT"):
    params = {
        "fromPlace": f"{from_lat},{from_lon}",
        "toPlace": f"{to_lat},{to_lon}",
        "mode": modes,
        "numItineraries": 3,
        "maxWalkDistance": 1500,
        "arriveBy": "false",
        "date": "2026-06-04",
        "time": "08:00am"
    }

    r = requests.get(OTP_BASE_URL, params=params)
    r.raise_for_status()
    data = r.json()

    itineraries = data.get("plan", {}).get("itineraries", [])

    results = []
    for i, itin in enumerate(itineraries):
        route = {
            "duration_sec": itin["duration"] / 1000,
            "transfers": itin["transfers"],
            "legs": []
        }

        for leg in itin["legs"]:
            route["legs"].append({
                "mode": leg["mode"],
                "start": leg["from"]["name"],
                "end": leg["to"]["name"],
                "duration_sec": leg["duration"] / 1000,
                "distance_m": leg.get("distance", 0),
                "route": leg.get("route", None)
            })

        results.append(route)

    return results


# Example: Montreal (approx coordinates)
routes = get_routes(
    from_lat=45.5017, from_lon=-73.5673,   # downtown Montreal
    to_lat=45.5590, to_lon=-73.6692        # example: Parc Jarry area
)

for i, r in enumerate(routes):
    print(f"\n=== Route {i+1} ===")
    print("Duration (min):", r["duration_sec"] / 60)
    print("Transfers:", r["transfers"])
    for leg in r["legs"]:
        print(" ", leg)