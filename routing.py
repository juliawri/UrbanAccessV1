import requests
import json
import polyline
import math

OTP_BASE_URL = "http://localhost:8080/otp/routers/default/plan"

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def sample_along_line(coords, step=50):
    if len(coords) < 2:
        return coords

    sampled = [coords[0]]
    acc_dist = 0

    for i in range(1, len(coords)):
        lat1, lon1 = coords[i - 1]
        lat2, lon2 = coords[i]

        seg_dist = haversine(lat1, lon1, lat2, lon2)
        acc_dist += seg_dist

        if acc_dist >= step:
            sampled.append((lat2, lon2))
            acc_dist = 0

    return sampled

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

            leg_data = {
                "mode": leg.get("mode"),
                "from": leg.get("from", {}).get("name"),
                "to": leg.get("to", {}).get("name"),
                "start_time": leg.get("startTime"),
                "end_time": leg.get("endTime"),
                "duration_sec": leg.get("duration", 0) / 1000,
                "distance_m": leg.get("distance", 0),
                "route": leg.get("route"),
                "geometry_sampled_50m": None
            }

            # ONLY for walking legs
            if leg.get("mode") == "WALK":
                geom = leg.get("legGeometry", {}).get("points")

                if geom:
                    coords = polyline.decode(geom)  # [(lat, lon), ...]
                    sampled = sample_along_line(coords, step=20)
                    leg_data["geometry_sampled_50m"] = sampled

            route["legs"].append(leg_data)

        routes_output.append(route)

    return routes_output


def save_routes_to_json(routes, filename="otp_routes.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(routes)} routes to {filename}")



"""exmample in montreal"""
if __name__ == "__main__":
    routes = get_routes(
        from_lat=45.53080483132569, from_lon=-73.61353945157414,   # mila
        to_lat=45.49758656380192, to_lon=-73.5799738767698        # accio cup
    )

    save_routes_to_json(routes, "montreal_routes.json")
