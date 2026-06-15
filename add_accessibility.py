import json
import pandas as pd
import numpy as np
from sklearn.neighbors import BallTree


def add_access(filename="montreal_routes.json", routes_data=None):
    if routes_data is not None:
        data = routes_data
    else:
        with open(filename, "r") as f:
            data = json.load(f)

    rows = []
    for route in data:
        route_id = route["route_id"]
        for leg in route["legs"]:
            if leg["mode"] != "WALK":
                continue
            coords = leg.get("geometry_sampled_50m", [])
            for i, (lat, lon) in enumerate(coords):
                rows.append({
                    "route_id": route_id,
                    "leg_from": leg["from"],
                    "leg_to": leg["to"],
                    "point_index": i,
                    "lat": lat,
                    "lon": lon
                })

    df = pd.DataFrame(rows)

    walk_routes = {}

    if not df.empty:
        access = pd.read_csv("collation_points_grid_centre-ville_cleaned.csv")
        print("initial col:", repr(access.columns.tolist()))
        access = access.rename(columns={"latitude": "lat", "longitude": "lon"})
        print("second col:", repr(access.columns.tolist()))
        access = access.dropna(subset=["lat", "lon"])

        access_coords = np.radians(access[["lat", "lon"]].values)
        tree = BallTree(access_coords, metric="haversine")

        route_coords = np.radians(df[["lat", "lon"]].values)
        dist, idx = tree.query(route_coords, k=1)

        df["nearest_access_index"] = idx[:, 0]
        df["distance_to_access_m"] = dist[:, 0] * 6371000

        # Use all CSV columns except the spatial ones already in df
        access_cols = [c for c in access.columns if c not in {"lat", "lon"}]

        for col in access_cols:
            df[col] = access.iloc[idx[:, 0]][col].values

        numeric_cols = [c for c in access_cols if df[c].dtype in (float, int) or pd.api.types.is_numeric_dtype(df[c])]
        agg_dict = {c: "mean" for c in numeric_cols if c in df.columns}
        agg_dict["distance_to_access_m"] = "mean"
        route_summary = df.groupby("route_id").agg(agg_dict).reset_index()

        summary_map = route_summary.set_index("route_id").to_dict(orient="index")

        for route_id, g in df.groupby("route_id"):
            walk_routes[int(route_id)] = {
                "summary": summary_map.get(route_id, {}),
                "points": g[[
                    "leg_from", "leg_to", "point_index", "lat", "lon",
                    "distance_to_access_m",
                ] + access_cols].to_dict(orient="records")
            }

    # Include ALL routes — transit routes with no walk CSV data are still useful to the LLM
    routes_out = []
    for route in data:
        route_id = int(route["route_id"])
        legs_meta = [
            {
                "mode": leg.get("mode") or "",
                "from": leg.get("from") or "",
                "to": leg.get("to") or "",
                "route": leg.get("route") or "",
                "duration_sec": leg.get("duration_sec", 0),
                "distance_m": leg.get("distance_m", 0),
            }
            for leg in route.get("legs", [])
        ]
        walk_data = walk_routes.get(route_id, {})
        routes_out.append({
            "route_id": route_id,
            "duration_sec": route.get("duration_sec", 0),
            "transfers": route.get("transfers", 0),
            "legs": legs_meta,
            "summary": walk_data.get("summary", {}),
            "points": walk_data.get("points", []),
        })
        modes = [l["mode"] for l in legs_meta if l["mode"]]
        
    with open("routes_with_accessibility.json", "w") as f:
        json.dump(routes_out, f, indent=2)

    return routes_out


