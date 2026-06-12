from routing import get_routes
from routing import save_routes_to_json
import add_accessibility


def run_pipeline(src_lat, src_lon, dst_lat, dst_lon, date=None):

    routes = get_routes(src_lat, src_lon, dst_lat, dst_lon, date=date)

    # Sort so transit routes come before walk-only (more useful options first)
    routes.sort(key=lambda r: 0 if any(l["mode"] != "WALK" for l in r["legs"]) else 1)
    # Re-index after sort so route_id matches position
    for i, r in enumerate(routes):
        r["route_id"] = i

    save_routes_to_json(routes)

    routes_with_access = add_accessibility.add_access(routes_data=routes)

    return routes, routes_with_access

