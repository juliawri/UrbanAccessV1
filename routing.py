import os
import requests
import json
import polyline
import math

OTP_BASE_URL = os.environ.get("OTP_URL", "http://localhost:8080/otp/routers/default/plan")

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

def _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, mode, num, date):
    params = {
        "fromPlace": f"{from_lat},{from_lon}",
        "toPlace": f"{to_lat},{to_lon}",
        "mode": mode,
        "numItineraries": num,
        "maxWalkDistance": 2000,
        "arriveBy": "false",
        "date": date or "2026-06-04",
        "time": "08:00am",
    }
    resp = requests.get(OTP_BASE_URL, params=params)
    resp.raise_for_status()
    return resp.json().get("plan", {}).get("itineraries", [])


def _parse_itinerary(idx, itin):
    route = {
        "route_id": idx,
        "duration_sec": itin.get("duration", 0),
        "transfers": itin.get("transfers", 0),
        "legs": [],
    }
    for leg in itin.get("legs", []):
        from_stop = leg.get("from", {})
        to_stop = leg.get("to", {})
        leg_data = {
            "mode": leg.get("mode"),
            "from": from_stop.get("name"),
            "from_lat": from_stop.get("lat"),
            "from_lon": from_stop.get("lon"),
            "to": to_stop.get("name"),
            "to_lat": to_stop.get("lat"),
            "to_lon": to_stop.get("lon"),
            "start_time": leg.get("startTime"),
            "end_time": leg.get("endTime"),
            "duration_sec": leg.get("duration", 0),
            "distance_m": leg.get("distance", 0),
            "route": leg.get("route"),
            "geometry_sampled_50m": None,
        }
        if leg.get("mode") == "WALK":
            geom = leg.get("legGeometry", {}).get("points")
            if geom:
                coords = polyline.decode(geom)
                leg_data["geometry_sampled_50m"] = sample_along_line(coords, step=20)
        route["legs"].append(leg_data)
    return route


def _route_signature(itin):
    """Key based on which transit lines are used — used for deduplication."""
    parts = []
    for leg in itin.get("legs", []):
        mode = leg.get("mode", "")
        if mode != "WALK":
            parts.append(f"{mode}:{leg.get('route') or leg.get('routeId') or ''}")
    return "|".join(parts) or "WALK"


def get_routes(from_lat, from_lon, to_lat, to_lon, date=None):
    eff_date = date or "2026-06-04"

    # Single broad request — OTP returns its best options first
    transit_raw = _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, "WALK,TRANSIT", 6, eff_date)
    walk_raw    = _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, "WALK", 1, eff_date)

    # Keep only itineraries that actually use a non-walk mode
    transit_itins = [it for it in transit_raw
                     if any(l.get("mode") != "WALK" for l in it.get("legs", []))]

    print(f"OTP ({eff_date}): {len(transit_itins)}/{len(transit_raw)} transit, {len(walk_raw)} walk-only")

    # If the requested date falls outside OTP's GTFS feed, retry with the known-good fallback date
    if not transit_itins and eff_date != "2026-06-04":
        print("No transit for requested date — retrying with fallback date 2026-06-04")
        transit_raw = _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, "WALK,TRANSIT", 6, "2026-06-04")
        walk_raw    = _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, "WALK", 1, "2026-06-04")
        transit_itins = [it for it in transit_raw
                         if any(l.get("mode") != "WALK" for l in it.get("legs", []))]
        print(f"OTP (fallback): {len(transit_itins)}/{len(transit_raw)} transit, {len(walk_raw)} walk-only")

    # Deduplicate by which lines are used (keeps best/fastest per combination)
    seen_sigs, unique = set(), []
    for it in transit_itins:
        sig = _route_signature(it)
        if sig not in seen_sigs:
            seen_sigs.add(sig)
            unique.append(it)

    # Prefer subway/metro first
    unique.sort(key=lambda it: 0 if any(l.get("mode") == "SUBWAY" for l in it.get("legs", [])) else 1)

    # Take up to 2 distinct transit routes + 1 walk-only
    chosen = unique[:2] + walk_raw[:1]

    # Backfill to 3 with same-line transit if needed (different departure time = useful)
    if len(chosen) < 3:
        ids_used = {id(it) for it in chosen}
        for it in transit_itins:
            if id(it) not in ids_used:
                chosen.append(it)
                ids_used.add(id(it))
                if len(chosen) >= 3:
                    break

    print(f"OTP final {len(chosen[:3])}: {[_route_signature(it) for it in chosen[:3]]}")
    return [_parse_itinerary(i, itin) for i, itin in enumerate(chosen[:3])]


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

