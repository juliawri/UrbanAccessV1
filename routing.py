import requests
import json

OTP_BASE_URL = "http://localhost:8080/otp/routers/default/plan"


def get_routes(from_lat, from_lon, to_lat, to_lon,
               modes="WALK,TRANSIT",
               num_itineraries=3):

    params = {
        "fromPlace": f"{from_lat},{from_lon}",
        "toPlace": f"{to_lat},{to_lon}",
        "mode": modes,
        "numItineraries": num_itineraries,
        "maxWalkDistance": 1500,
        "arriveBy": "false",
        "date": "2026-06-04",
        "time": "08:00am"
    }

    response = requests.get(OTP_BASE_URL, params=params)
    response.raise_for_status()
    data = response.json()

    itineraries = data.get("plan", {}).get("itineraries", [])

    routes_output = []

    for idx, itin in enumerate(itineraries):
        route = {
            "route_id": idx,
            "duration_sec": itin.get("duration", 0) / 1000,
            "transfers": itin.get("transfers", 0),
            "legs": []
        }

        for leg in itin.get("legs", []):
            route["legs"].append({
                "mode": leg.get("mode"),
                "from": leg.get("from", {}).get("name"),
                "to": leg.get("to", {}).get("name"),
                "start_time": leg.get("startTime"),
                "end_time": leg.get("endTime"),
                "duration_sec": leg.get("duration", 0) / 1000,
                "distance_m": leg.get("distance", 0),
                "route": leg.get("route")
            })

        routes_output.append(route)

    return routes_output


def save_routes_to_json(routes, filename="otp_routes.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(routes)} routes to {filename}")



"""exmample in montreal"""
if __name__ == "__main__":
    routes = get_routes(
        from_lat=45.5017, from_lon=-73.5673,   # downtown Montreal
        to_lat=45.5590, to_lon=-73.6692        # Jarry Park area
    )

    save_routes_to_json(routes, "montreal_routes.json")