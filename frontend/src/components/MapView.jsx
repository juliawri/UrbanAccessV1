import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const LEG_COLORS = { WALK: '#2196F3', BUS: '#FF9800', SUBWAY: '#9C27B0', TRAM: '#4CAF50' }

const originIcon = new L.DivIcon({
  html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14], iconAnchor: [7, 7], className: '',
})
const destIcon = new L.DivIcon({
  html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14], iconAnchor: [7, 7], className: '',
})

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng) },
  })
  return null
}

export default function MapView({ routes, origin, destination, mapClickMode, onMapClick }) {
  const legs = routes[0]?.legs ?? []

  return (
    <MapContainer
      center={[45.5017, -73.5673]}
      zoom={13}
      style={{ height: '100%', minHeight: 640 }}
      className={mapClickMode ? 'map-pick-mode' : ''}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
      />
      <MapClickHandler onMapClick={onMapClick} />
      {origin && (
        <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
          <Popup>Origin: {origin.label}</Popup>
        </Marker>
      )}
      {destination && (
        <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
          <Popup>Destination: {destination.label}</Popup>
        </Marker>
      )}
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