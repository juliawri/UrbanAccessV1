from routing import get_routes
from routing import save_routes_to_json
import add_accessibility


def run_pipeline(src_lat, src_lon, dst_lat, dst_lon):
    
    routes = get_routes(src_lat, src_lon, dst_lat, dst_lon)
    save_routes_to_json(routes)

    add_accessibility.add_access("montreal_routes.json")

    return routes