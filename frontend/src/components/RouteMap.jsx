import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ROUTE_COLORS, ROUTE_LABELS } from './routeColors'

function FitRoute({ route }) {
  const map = useMap()
  useEffect(() => {
    if (!route) return
    const allPts = route.legs.flatMap(leg => {
      const pts = leg.geometry_sampled_50m
      if (!pts || pts.length < 2) return []
      return pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
    })
    if (allPts.length > 1) {
      map.fitBounds(L.latLngBounds(allPts).pad(0.12))
    }
  }, [route, map])
  return null
}

export default function RouteMap({ routes, origin, destination }) {
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0)
  const activeColor = ROUTE_COLORS[selectedRouteIdx] ?? '#888'

  return (
    <div style={{ position: 'relative', height: '83vh', borderRadius: '12px', overflow: 'hidden', marginTop: '32px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <MapContainer
        center={[45.5017, -73.5673]}
        zoom={13}
        style={{ height: '100%', borderRadius: '12px', zIndex: 0 }}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <FitRoute route={routes[selectedRouteIdx]} />

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

        {(routes[selectedRouteIdx]?.legs ?? []).map((leg, legIdx) => {
          const pts = leg.geometry_sampled_50m
          if (!pts || pts.length < 2) return null
          const positions = pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
          return (
            <Polyline
              key={legIdx}
              positions={positions}
              pathOptions={{ color: activeColor, weight: 5, opacity: 0.95 }}
            />
          )
        })}
      </MapContainer>

      {/* Route selector dropdown */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.97)',
        borderRadius: '10px',
        padding: '10px 14px 12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
        minWidth: '230px',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#1e3d3d',
          marginBottom: '7px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          What Route Do You Want to Display?
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedRouteIdx}
            onChange={e => setSelectedRouteIdx(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '7px 32px 7px 10px',
              border: `2px solid ${activeColor}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: activeColor,
              background: 'white',
              appearance: 'none',
              WebkitAppearance: 'none',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {routes.map((_, i) => (
              <option key={i} value={i} style={{ color: ROUTE_COLORS[i] ?? '#1a1a1a' }}>
                {ROUTE_LABELS[i] ?? `Option ${i + 1}`}
              </option>
            ))}
          </select>
          <svg
            width="12" height="8" viewBox="0 0 12 8"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <path d="M1 1l5 5 5-5" stroke={activeColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}
