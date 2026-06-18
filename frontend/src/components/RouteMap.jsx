import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ROUTE_COLORS, ROUTE_LABELS } from './routeColors'

function FitAllRoutes({ routes }) {
  const map = useMap()
  useEffect(() => {
    if (!routes.length) return
    const allPts = routes.flatMap(route =>
      route.legs.flatMap(leg => {
        const pts = leg.geometry_sampled_50m
        if (!pts || pts.length < 2) return []
        return pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
      })
    )
    if (allPts.length > 1) {
      map.fitBounds(L.latLngBounds(allPts).pad(0.12))
    }
  }, [routes, map])
  return null
}

export default function RouteMap({ routes, origin, destination }) {
  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <MapContainer
        center={[45.5017, -73.5673]}
        zoom={13}
        style={{ height: 240, borderRadius: '12px', zIndex: 0 }}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <FitAllRoutes routes={routes} />

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

        {routes.map((route, routeIdx) =>
          route.legs.map((leg, legIdx) => {
            const pts = leg.geometry_sampled_50m
            if (!pts || pts.length < 2) return null
            const positions = pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
            return (
              <Polyline
                key={`${routeIdx}-${legIdx}`}
                positions={positions}
                pathOptions={{
                  color: ROUTE_COLORS[routeIdx] ?? '#888',
                  weight: routeIdx === 0 ? 5 : 4,
                  opacity: routeIdx === 0 ? 0.95 : 0.72,
                  dashArray: routeIdx === 1 ? '10,5' : routeIdx === 2 ? '4,6' : null,
                }}
              />
            )
          })
        )}
      </MapContainer>

      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '6px',
        padding: '6px 10px',
        zIndex: 1000,
        fontSize: '12px',
        lineHeight: '1.5',
        boxShadow: '0 1px 5px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      }}>
        {ROUTE_LABELS.slice(0, routes.length).map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: i < routes.length - 1 ? 4 : 0 }}>
            <svg width="22" height="6" style={{ flexShrink: 0 }}>
              <line
                x1="0" y1="3" x2="22" y2="3"
                stroke={ROUTE_COLORS[i]}
                strokeWidth={i === 0 ? 3 : 2.5}
                strokeDasharray={i === 1 ? '6,3' : i === 2 ? '2.5,3.5' : null}
              />
            </svg>
            <span style={{ color: ROUTE_COLORS[i], fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
