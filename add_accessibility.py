import json
import pandas as pd
import numpy as np
from sklearn.neighbors import BallTree


"""load routes json"""
with open("montreal_routes.json", "r") as f:
    data = json.load(f)


"""flatten walk geometry"""
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


"""load accessibility data"""
access = pd.read_csv("collation_points_grid_centre-ville.csv")

access = access.rename(columns={
    "latitude": "lat",
    "longitude": "lon"
})


access = access.dropna(subset=["lat", "lon"])


"""build spatial index"""
access_coords = np.radians(access[["lat", "lon"]].values)
tree = BallTree(access_coords, metric="haversine")


"""match each route point to nearest accessibility point"""
route_coords = np.radians(df[["lat", "lon"]].values)

dist, idx = tree.query(route_coords, k=1)

df["nearest_access_index"] = idx[:, 0]
df["distance_to_access_m"] = dist[:, 0] * 6371000  # radians → meters


"""attach accessibility features"""
access_cols = [
    "point_id",
    "arrondissement",
    "heat_class",
    "heat_label",
    "total_feature",
    "collisions_n",
    "collisions_vic",
    "collisions_m",
    "collisions_bl",
    "collisions_gr",
    "permis_n",
    "permis_loger",
    "permis_types",
    "entraves_n",
    "entraves_act",
    "entraves_rai",
    "entraves_fin",
    "arbres_n",
    "arbres_especes_top",
    "arbres_dhp",
    "emplacements_arbres_n"
]

# keep only columns that actually exist (prevents crashes)
access_cols = [c for c in access_cols if c in access.columns]

for col in access_cols:
    df[col] = access.iloc[idx[:, 0]][col].values


"""route summary metrics"""
route_summary = df.groupby("route_id").agg({
    "distance_to_access_m": "mean",
    "heat_class": "mean",
    "collisions_n": "mean",
    "arbres_n": "mean"
}).reset_index()

print(route_summary.head())


"""save outpus"""
# build per-route summaries
summary_map = route_summary.set_index("route_id").to_dict(orient="index")

# build structured routes
routes_out = []

for route_id, g in df.groupby("route_id"):
    route_obj = {
        "route_id": int(route_id),
        "summary": summary_map.get(route_id, {}),
        "points": g[[
            "leg_from",
            "leg_to",
            "point_index",
            "lat",
            "lon",
            "distance_to_access_m",
        ] + access_cols].to_dict(orient="records")
    }

    routes_out.append(route_obj)

# save JSON
with open("routes_with_accessibility.json", "w") as f:
    json.dump(routes_out, f, indent=2)

print("Saved routes_with_accessibility.json")