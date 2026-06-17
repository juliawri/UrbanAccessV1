import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix Leaflet default marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const LEG_COLORS = {
  WALK:   '#2196F3',
  BUS:    '#FF9800',
  SUBWAY: '#9C27B0',
  TRAM:   '#4CAF50',
}

// Fits the map to the drawn routes whenever routes change
function FitBounds({ routes }) {
  const map = useMap()
  useEffect(() => {
    if (!routes.length) return
    const allPts = routes[0].legs.flatMap(leg => {
      const pts = leg.geometry_sampled_50m
      if (!pts || pts.length < 2) return []
      return pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
    })
    if (allPts.length > 1) {
      map.fitBounds(L.latLngBounds(allPts).pad(0.1))
    }
  }, [routes, map])
  return null
}

export default function MapView({ routes }) {
  const legs = routes[0]?.legs ?? []

  return (
    <MapContainer
      center={[45.5017, -73.5673]}
      zoom={13}
      style={{ height: 480, borderRadius: '8px', zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      <FitBounds routes={routes} />
      {legs.map((leg, i) => {
        const pts = leg.geometry_sampled_50m
        if (!pts || pts.length < 2) return null
        const positions = pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
        return (
          <Polyline
            key={i}
            positions={positions}
            pathOptions={{
              color:   LEG_COLORS[leg.mode] ?? '#888',
              weight:  5,
              opacity: 0.85,
            }}
          />
        )
      })}
    </MapContainer>
  )
}
