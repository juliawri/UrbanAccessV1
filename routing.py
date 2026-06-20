import requests
import json
import polyline
import math
import os

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

def _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, mode, num, date, time=None):
    params = {
        "fromPlace": f"{from_lat},{from_lon}",
        "toPlace": f"{to_lat},{to_lon}",
        "mode": mode,
        "numItineraries": num,
        "maxWalkDistance": 2000,
        "arriveBy": "false",
        "date": date or "2026-06-04",
        "time": time or "08:00am",
    }
    resp = requests.get(OTP_BASE_URL, params=params)
    resp.raise_for_status()
    return resp.json().get("plan", {}).get("itineraries", [])


def _merge_walk_legs(legs):
    """Collapse a list of consecutive walk legs into a single walk leg."""
    if not legs:
        return []
    all_coords = []
    all_steps = []
    for leg in legs:
        pts = leg.get("legGeometry", {}).get("points")
        if pts:
            coords = polyline.decode(pts)
            # Skip the first point of each subsequent segment — it duplicates the last
            all_coords.extend(coords if not all_coords else coords[1:])
        all_steps.extend(leg.get("steps", []))
    return [{
        "mode":     "WALK",
        "from":     legs[0].get("from"),
        "to":       legs[-1].get("to"),
        "startTime": legs[0].get("startTime"),
        "endTime":   legs[-1].get("endTime"),
        "duration":  sum(l.get("duration", 0) for l in legs),
        "distance":  sum(l.get("distance", 0) for l in legs),
        "legGeometry": {
            "points": polyline.encode(all_coords) if all_coords else "",
            "length": len(all_coords),
        },
        "steps": all_steps,
        "route": None,
        "routeLongName": None,
        "routeShortName": "",
    }]


def _fetch_walk_variants(from_lat, from_lon, to_lat, to_lon, date, time=None):
    """
    Fetch diverse walk routes by chaining two OTP requests through mandatory waypoints.
    OTP1 ignores intermediatePlaces for walk-only mode, so chaining is the only reliable
    way to force different corridors: origin→waypoint and waypoint→destination are each
    independent optimal-path queries, so OTP cannot route around the waypoint.
    """
    eff_date = date or "2026-06-04"
    eff_time = time or "08:00am"
    direct_dist = haversine(from_lat, from_lon, to_lat, to_lon)
    offset_m = max(400, min(800, direct_dist * 0.4))
    max_walk = max(8000, int(direct_dist * 4))

    mid_lat = (from_lat + to_lat) / 2
    mid_lon = (from_lon + to_lon) / 2

    def _waypoint(angle_deg):
        rad = math.radians(angle_deg)
        dlat = offset_m / 111_000 * math.cos(rad)
        dlon = offset_m / (111_000 * math.cos(math.radians(mid_lat))) * math.sin(rad)
        return mid_lat + dlat, mid_lon + dlon

    def _walk_segment(a_lat, a_lon, b_lat, b_lon):
        url = (
            f"{OTP_BASE_URL}?fromPlace={a_lat},{a_lon}&toPlace={b_lat},{b_lon}"
            f"&mode=WALK&numItineraries=1&maxWalkDistance={max_walk}"
            f"&arriveBy=false&date={eff_date}&time={eff_time}"
        )
        try:
            resp = requests.get(url)
            resp.raise_for_status()
            itins = resp.json().get("plan", {}).get("itineraries", [])
            return itins[0] if itins else None
        except Exception as e:
            print(f"[routing] Walk segment ({a_lat:.4f},{a_lon:.4f})→({b_lat:.4f},{b_lon:.4f}) OTP request failed: {str(e)[:60]}")
            return None

    itins = []

    # Direct route
    direct = _walk_segment(from_lat, from_lon, to_lat, to_lon)
    if direct:
        itins.append(direct)
        print(f"[routing] Direct walk route computed: {round(_total_distance_m(direct))}m total distance")

    # Chained routes: origin→waypoint + waypoint→destination
    for angle in (0, 90, 180, 270):
        wp_lat, wp_lon = _waypoint(angle)
        seg1 = _walk_segment(from_lat, from_lon, wp_lat, wp_lon)
        seg2 = _walk_segment(wp_lat, wp_lon, to_lat, to_lon)
        if seg1 and seg2:
            merged = {
                "duration":  seg1.get("duration", 0) + seg2.get("duration", 0),
                "transfers": 0,
                "legs":      _merge_walk_legs(seg1.get("legs", []) + seg2.get("legs", [])),
            }
            print(f"[routing] Walk via angle={angle}°: {round(_total_distance_m(merged))}m total distance")
            itins.append(merged)
        else:
            s1 = "ok" if seg1 is not None else "missing"
            s2 = "ok" if seg2 is not None else "missing"
            print(f"[routing] Walk via angle={angle}° failed to compute — seg1={s1}, seg2={s2}")

    print(f"[routing] {len(itins)} walk route candidates generated before deduplication")
    return itins


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
        walk_steps = None
        if leg.get("mode") == "WALK":
            raw_steps = leg.get("steps", [])
            walk_steps = [
                {
                    "direction": s.get("relativeDirection", ""),
                    "street": s.get("streetName", ""),
                    "distance_m": round(s.get("distance", 0)),
                    "bogus_name": s.get("bogusName", False),
                }
                for s in raw_steps
            ] or None

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
            "route": leg.get("routeLongName") or leg.get("route"),
            "route_short_name": leg.get("routeShortName") or "",
            "walk_steps": walk_steps,
            "geometry_sampled_50m": None,
        }
        geom = leg.get("legGeometry", {}).get("points")
        if geom:
            coords = polyline.decode(geom)
            leg_data["geometry_sampled_50m"] = sample_along_line(coords, step=20)
        route["legs"].append(leg_data)
    return route


def _total_distance_m(itin):
    return sum(leg.get("distance", 0) for leg in itin.get("legs", []))


def _walk_signature(itin):
    """
    Deduplicate walk routes by the geographic midpoint of their geometry (~11 m precision).
    Distance-based dedup falsely collapses routes with different paths but similar lengths.
    """
    all_coords = []
    for leg in itin.get("legs", []):
        geom = leg.get("legGeometry", {}).get("points")
        if geom:
            try:
                all_coords.extend(polyline.decode(geom))
            except Exception:
                pass
    if not all_coords:
        return f"walk:dist:{round(_total_distance_m(itin) / 50) * 50}"
    mid = all_coords[len(all_coords) // 2]
    return f"walk:{round(mid[0], 4)}:{round(mid[1], 4)}"


def _route_signature(itin):
    """Key based on transit lines and their boarding/alighting stops — used for deduplication."""
    parts = []
    for leg in itin.get("legs", []):
        mode = leg.get("mode", "")
        if mode != "WALK":
            route = leg.get("route") or leg.get("routeId") or ""
            from_name = (leg.get("from") or {}).get("name", "") if isinstance(leg.get("from"), dict) else leg.get("from", "")
            to_name = (leg.get("to") or {}).get("name", "") if isinstance(leg.get("to"), dict) else leg.get("to", "")
            parts.append(f"{mode}:{route}:{from_name}→{to_name}")
    return "|".join(parts) or "WALK"


def get_routes(from_lat, from_lon, to_lat, to_lon, date=None, time=None):
    eff_date = date or "2026-06-04"
    eff_time = time or "08:00am"

    # Single broad request — OTP returns its best options first
    transit_raw = _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, "WALK,TRANSIT", 12, eff_date, eff_time)

    # Walk variants: four optimize modes → deduplicated by distance+duration
    walk_candidates = _fetch_walk_variants(from_lat, from_lon, to_lat, to_lon, eff_date, eff_time)
    _walk_seen, walk_raw = set(), []
    for it in walk_candidates:
        if _total_distance_m(it) > 2000:
            continue
        sig = _walk_signature(it)
        if sig not in _walk_seen:
            _walk_seen.add(sig)
            walk_raw.append(it)

    # Keep only itineraries that actually use a non-walk mode
    transit_itins = [it for it in transit_raw
                     if any(l.get("mode") != "WALK" for l in it.get("legs", []))]

    print(f"[otp] {eff_date}: {len(transit_itins)}/{len(transit_raw)} valid transit itineraries, {len(walk_raw)} walk-only candidates (≤2 km)")

    # If the requested date falls outside OTP's GTFS feed, retry with the known-good fallback date
    if not transit_itins and eff_date != "2026-06-04":
        print("[otp] No transit itineraries for requested date — retrying with fallback date 2026-06-04")
        transit_raw = _fetch_itineraries(from_lat, from_lon, to_lat, to_lon, "WALK,TRANSIT", 12, "2026-06-04")
        walk_candidates = _fetch_walk_variants(from_lat, from_lon, to_lat, to_lon, "2026-06-04")
        _walk_seen, walk_raw = set(), []
        for it in walk_candidates:
            if _total_distance_m(it) > 2000:
                continue
            sig = _walk_signature(it)
            if sig not in _walk_seen:
                _walk_seen.add(sig)
                walk_raw.append(it)
        transit_itins = [it for it in transit_raw
                         if any(l.get("mode") != "WALK" for l in it.get("legs", []))]
        print(f"[otp] Fallback date 2026-06-04: {len(transit_itins)}/{len(transit_raw)} valid transit itineraries, {len(walk_raw)} walk-only candidates (≤2 km)")

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

    # Backfill to 3: try remaining unique transit routes, then extra walk routes
    if len(chosen) < 3:
        chosen_ids = {id(it) for it in chosen}
        chosen_sigs = {_route_signature(it) for it in chosen}
        for it in transit_itins:
            if id(it) in chosen_ids:
                continue
            sig = _route_signature(it)
            if sig in chosen_sigs:
                continue
            chosen.append(it)
            chosen_ids.add(id(it))
            chosen_sigs.add(sig)
            if len(chosen) >= 3:
                break
        for it in walk_raw[1:]:
            if len(chosen) >= 3:
                break
            if id(it) not in chosen_ids:
                chosen.append(it)
                chosen_ids.add(id(it))

    # Final fallback: use walk candidates ignoring the 2 km cap — avoids adding
    # same-signature transit routes that would look visually identical on the map.
    if len(chosen) < 3:
        chosen_ids = {id(it) for it in chosen}
        chosen_walk_sigs = {_walk_signature(it) for it in chosen}
        for it in walk_candidates:
            if len(chosen) >= 3:
                break
            sig = _walk_signature(it)
            if sig not in chosen_walk_sigs:
                chosen.append(it)
                chosen_ids.add(id(it))
                chosen_walk_sigs.add(sig)

    sigs = [_route_signature(it) for it in chosen[:3]]
    print(f"[otp] Final selection: {len(chosen[:3])} routes — {sigs}")
    return [_parse_itinerary(i, itin) for i, itin in enumerate(chosen[:3])]


def save_routes_to_json(routes, filename="otp_routes.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2, ensure_ascii=False)
    print(f"[routing] Saved {len(routes)} parsed route(s) to {filename}")



"""exmample in montreal"""
if __name__ == "__main__":
    routes = get_routes(
        from_lat=45.53080483132569, from_lon=-73.61353945157414,   # mila
        to_lat=45.49758656380192, to_lon=-73.5799738767698        # accio cup
    )

    save_routes_to_json(routes, "montreal_routes.json")

