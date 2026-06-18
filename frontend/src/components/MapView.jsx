import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

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

function ClickHandler({ onMapClick, inputMode }) {
  useMapEvents({
    click(e) {
      if (inputMode === 'map') {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
  })
  return null
}

const TRANSIT_MODES = new Set(['BUS', 'SUBWAY', 'TRAM'])

export default function MapView({ routes, onMapClick, inputMode, origin, destination, mapHeight = 480, borderRadius = '8px' }) {
  const legs = routes[0]?.legs ?? []
  const zoom = parseInt(localStorage.getItem('default_zoom') || '13', 10)
  const showStopNames = localStorage.getItem('show_stop_names') === 'true'

  return (
    <MapContainer
      center={[45.5017, -73.5673]}
      zoom={zoom}
      style={{
        height: mapHeight,
        borderRadius,
        zIndex: 0,
        cursor: inputMode === 'map' ? 'crosshair' : 'grab',
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      <ClickHandler onMapClick={onMapClick} inputMode={inputMode} />
      <FitBounds routes={routes} />

      {origin && (
        <Marker position={[origin.lat, origin.lng]}>
          <Popup>Origin</Popup>
        </Marker>
      )}
      {destination && (
        <Marker position={[destination.lat, destination.lng]}>
          <Popup>Destination</Popup>
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
            pathOptions={{
              color:   LEG_COLORS[leg.mode] ?? '#888',
              weight:  5,
              opacity: 0.85,
            }}
          />
        )
      })}

      {showStopNames && legs.filter(leg => TRANSIT_MODES.has(leg.mode)).map((leg, i) => {
        const pts = leg.geometry_sampled_50m
        if (!pts || pts.length < 1) return null
        const first = Array.isArray(pts[0]) ? pts[0] : [pts[0].lat, pts[0].lon]
        const last  = Array.isArray(pts[pts.length - 1]) ? pts[pts.length - 1] : [pts[pts.length - 1].lat, pts[pts.length - 1].lon]
        return [
          leg.from && <Marker key={`stop-from-${i}`} position={first}><Popup>{leg.from}</Popup></Marker>,
          leg.to   && <Marker key={`stop-to-${i}`}   position={last}><Popup>{leg.to}</Popup></Marker>,
        ]
      })}
    </MapContainer>
  )
}
