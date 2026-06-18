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

export default function MapView({ routes, origin, destination, mapClickMode, onMapClick, selectedRouteIdx, onRouteSelect }) {
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
      {/* Render unselected routes first, selected last so it paints on top */}
      {[...routes.map((r, i) => ({ route: r, idx: i }))].sort((a, b) =>
        a.idx === selectedRouteIdx ? 1 : b.idx === selectedRouteIdx ? -1 : 0
      ).map(({ route, idx }) => {
        const isSelected = idx === selectedRouteIdx
        const opacity    = isSelected ? 0.85 : 0.55
        const weight     = isSelected ? 5 : 3
        const outlineColor = (!isSelected && idx === 0) ? 'white' : null

        return route.legs.flatMap((leg, i) => {
          const pts = leg.geometry_sampled_50m
          const isTransit = leg.mode === 'BUS' || leg.mode === 'SUBWAY'

          let positions
          if (pts && pts.length >= 2) {
            positions = pts.map(p => Array.isArray(p) ? p : [p.lat, p.lon])
          } else if (isTransit && leg.from_lat != null && leg.to_lat != null) {
            positions = [[leg.from_lat, leg.from_lon], [leg.to_lat, leg.to_lon]]
          } else {
            return []
          }

          const sharedClick = { click: () => onRouteSelect(idx) }
          const fillLine = (
            <Polyline
              key={`${idx}-${i}-fill`}
              positions={positions}
              eventHandlers={sharedClick}
              pathOptions={{
                color: isTransit ? '#E87010' : (LEG_COLORS[leg.mode] ?? '#888'),
                weight,
                opacity,
                dashArray: isTransit ? '10 6' : undefined,
              }}
            />
          )

          if (!outlineColor) return [fillLine]

          return [
            <Polyline
              key={`${idx}-${i}-outline`}
              positions={positions}
              eventHandlers={sharedClick}
              pathOptions={{
                color: outlineColor,
                weight: weight + 2,
                opacity,
                dashArray: isTransit ? '10 6' : undefined,
              }}
            />,
            fillLine,
          ]
        })
      })}
    </MapContainer>
  )
}