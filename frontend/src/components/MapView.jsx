import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'

const LEG_COLORS = { WALK: '#2196F3', BUS: '#FF9800', SUBWAY: '#9C27B0', TRAM: '#4CAF50' }

export default function MapView({ routes }) {
  const legs = routes[0]?.legs ?? []

  return (
    <MapContainer center={[45.5017, -73.5673]} zoom={13} style={{ height: 480 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
      />
      {legs.map((leg, i) => {
        const pts = leg.geometry_sampled_50m
        if (!pts || pts.length < 2) return null
        const positions = pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
        return (
          <Polyline
            key={i}
            positions={positions}
            pathOptions={{ color: LEG_COLORS[leg.mode] ?? '#888', weight: 5, opacity: 0.8 }}
          />
        )
      })}
    </MapContainer>
  )
}