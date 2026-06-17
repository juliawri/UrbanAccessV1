# React + Chakra UI Migration Guide

This guide walks you through converting `index.html` (vanilla JS + Leaflet) into a
React + Chakra UI + React-Leaflet frontend that talks to your existing FastAPI backend.

---

## 1. Scaffold the React App

From inside your project root:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

Your repo will now look like:

```
UrbanAccessV1/
├── frontend/          ← new React app lives here
│   ├── src/
│   ├── index.html
│   └── vite.config.js
├── main.py            ← FastAPI (unchanged)
├── app.py
└── index.html         ← keep for now; remove when done
```

---

## 2. Install Dependencies

```bash
cd frontend

# Chakra UI v3 + its peer deps
npm install @chakra-ui/react @emotion/react

# React-Leaflet (wraps Leaflet for React)
npm install react-leaflet leaflet

# Leaflet types aren't needed but the CSS must be imported
```

---

## 3. Configure the Dev Proxy

Vite can proxy `/process`, `/stops`, and `/submit` to your FastAPI server so you
never have to hardcode ports or deal with CORS during development.

**`frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/process': 'http://localhost:8000',
      '/stops':   'http://localhost:8000',
      '/submit':  'http://localhost:8000',
    },
  },
})
```

---

## 4. Bootstrap Chakra UI

**`frontend/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import App from './App'
import 'leaflet/dist/leaflet.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
)
```

---

## 5. Component Structure

Break the monolithic `index.html` into these components:

```
src/
├── main.jsx
├── App.jsx
├── api.js                      ← all fetch calls in one place
└── components/
    ├── ControlPanel.jsx        ← mobility aid, date, mode toggle
    ├── Autocomplete.jsx        ← reusable address/stop search input
    ├── MapView.jsx             ← react-leaflet map
    ├── RouteDirections.jsx     ← leg-by-leg directions list
    └── FeedbackForm.jsx        ← rating + comment form
```

---

## 6. API Layer

Centralise all network calls so components stay clean.

**`frontend/src/api.js`**

```js
const BASE = ''   // empty = same origin (proxy handles it in dev)

export async function searchStops(q) {
  const res = await fetch(`${BASE}/stops?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  return res.json()
}

export async function planRoute({ source, destination, disability_type, date }) {
  const res = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, destination, disability_type, date }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()   // { routes, result }
}

export async function submitFeedback(payload) {
  const res = await fetch(`${BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()   // { id }
}
```

---

## 7. Key Component Sketches

### App.jsx — top-level state

```jsx
import { useState } from 'react'
import { Box, Heading, Stack } from '@chakra-ui/react'
import ControlPanel from './components/ControlPanel'
import MapView from './components/MapView'
import RouteDirections from './components/RouteDirections'
import FeedbackForm from './components/FeedbackForm'
import { planRoute } from './api'

export default function App() {
  const [routes, setRoutes] = useState([])
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastPayload, setLastPayload] = useState(null)

  async function handlePlan(payload) {
    setLoading(true)
    try {
      const data = await planRoute(payload)
      setRoutes(data.routes)
      setResult(data.result)
      setLastPayload(payload)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxW="900px" mx="auto" p={4}>
      <Heading size="lg" mb={4}>Accessibility Route Planner</Heading>
      <Stack gap={4}>
        <ControlPanel onPlan={handlePlan} loading={loading} />
        <MapView routes={routes} />
        {result && <RouteDirections routes={routes} result={result} />}
        {routes.length > 0 && (
          <FeedbackForm payload={lastPayload} routes={routes} result={result} />
        )}
      </Stack>
    </Box>
  )
}
```

### ControlPanel.jsx — Chakra form controls

```jsx
import { useState } from 'react'
import {
  Stack, HStack, Button, Select, Input, Field
} from '@chakra-ui/react'
import Autocomplete from './Autocomplete'

const MOBILITY_AIDS = [
  'Manual Wheelchair', 'Electric Wheelchair', 'Walker',
  'Walking Cane', 'Mobility Scooter', 'No Mobility Aid',
]

export default function ControlPanel({ onPlan, loading }) {
  const [disabilityType, setDisabilityType] = useState('manual wheelchair')
  const [date, setDate] = useState('2026-04-15')
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)

  function handleSubmit() {
    if (!origin || !destination) return
    onPlan({
      source:          { lat: origin.lat, lng: origin.lng },
      destination:     { lat: destination.lat, lng: destination.lng },
      disability_type: disabilityType,
      date,
    })
  }

  return (
    <Stack gap={3}>
      <HStack>
        <Field.Root label="Mobility Aid">
          <Select.Root
            value={disabilityType}
            onValueChange={({ value }) => setDisabilityType(value[0])}
            collection={/* use createListCollection */ null}
          >
            {/* see Chakra Select docs for collection setup */}
          </Select.Root>
        </Field.Root>
        <Field.Root label="Date">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field.Root>
      </HStack>

      <Autocomplete label="Origin"      onSelect={setOrigin} />
      <Autocomplete label="Destination" onSelect={setDestination} />

      <Button
        colorPalette="blue"
        onClick={handleSubmit}
        loading={loading}
        disabled={!origin || !destination}
      >
        Plan Route
      </Button>
    </Stack>
  )
}
```

### Autocomplete.jsx — reuses `/stops` + Photon geocoder

```jsx
import { useState, useCallback } from 'react'
import { Box, Input, List } from '@chakra-ui/react'
import { searchStops } from '../api'

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

export default function Autocomplete({ label, onSelect }) {
  const [query, setQuery]     = useState('')
  const [items, setItems]     = useState([])
  const [open, setOpen]       = useState(false)

  const search = useCallback(debounce(async (q) => {
    if (q.length < 2) { setItems([]); return }

    // Transit stops from backend
    const stops = await searchStops(q)
    const stopResults = stops.map(s => ({
      label: s.name,
      badge: s.type === 'metro_station' ? 'METRO' : 'BUS',
      lat: s.lat, lng: s.lon,
    }))

    // Photon geocoder for addresses
    const photon = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&bbox=-74.1,45.2,-73.3,45.8&lang=en`
    ).then(r => r.json()).catch(() => ({ features: [] }))

    const addrResults = photon.features.map(f => {
      const p = f.properties
      const [lon, lat] = f.geometry.coordinates
      return { label: p.name || p.street || q, badge: 'ADDR', lat, lng: lon }
    })

    setItems([...stopResults, ...addrResults])
    setOpen(true)
  }, 300), [])

  function handleSelect(item) {
    setQuery(item.label)
    setOpen(false)
    onSelect(item)
  }

  return (
    <Box position="relative">
      <Input
        placeholder={`${label} — address or transit stop…`}
        value={query}
        onChange={e => { setQuery(e.target.value); search(e.target.value); onSelect(null) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <List.Root
          position="absolute" zIndex={9000} bg="white"
          border="1px solid" borderColor="gray.200" borderRadius="md"
          boxShadow="md" w="100%" maxH="240px" overflowY="auto"
        >
          {items.map((item, i) => (
            <List.Item
              key={i} px={3} py={2} cursor="pointer" fontSize="sm"
              _hover={{ bg: 'blue.50' }}
              onMouseDown={() => handleSelect(item)}
            >
              <Box as="span" fontWeight="bold" fontSize="xs" mr={2}
                bg="blue.500" color="white" px={1} borderRadius="sm">
                {item.badge}
              </Box>
              {item.label}
            </List.Item>
          ))}
        </List.Root>
      )}
    </Box>
  )
}
```

### MapView.jsx — React-Leaflet

```jsx
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
```

### RouteDirections.jsx — Chakra Card per route

```jsx
import { Stack, HStack, Text, Badge, Box, Card } from '@chakra-ui/react'

const MODE_COLOR = { WALK: 'blue', BUS: 'orange', SUBWAY: 'purple', TRAM: 'green' }

function fmtDist(m) { return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m` }
function fmtTime(s) { const m = Math.round(s/60); return m < 1 ? '<1 min' : `${m} min` }

export default function RouteDirections({ routes, result }) {
  const labels = ['Recommended Route', 'Alternative 1', 'Alternative 2']

  return (
    <Stack gap={4}>
      {routes.map((route, idx) => {
        const totalMin = Math.round(route.legs.reduce((s, l) => s + (l.duration_sec ?? 0), 0) / 60)
        return (
          <Card.Root key={idx}>
            <Card.Header>
              <HStack justify="space-between">
                <Text fontWeight="bold">{labels[idx] ?? `Option ${idx+1}`}</Text>
                <Text color="gray.500" fontSize="sm">{totalMin} min</Text>
              </HStack>
            </Card.Header>
            <Card.Body>
              <Stack gap={2}>
                {route.legs.map((leg, li) => (
                  <HStack key={li} p={2} borderLeft="4px solid"
                    borderColor={`${MODE_COLOR[leg.mode] ?? 'gray'}.400`}
                    bg="gray.50" borderRadius="sm" align="start">
                    <Badge colorPalette={MODE_COLOR[leg.mode] ?? 'gray'}>{leg.mode}</Badge>
                    <Box fontSize="sm">
                      <Text>{leg.from} → {leg.to}{leg.route ? ` (${leg.route})` : ''}</Text>
                      <Text color="gray.500" fontSize="xs">
                        {[leg.distance_m != null ? fmtDist(leg.distance_m) : null,
                          leg.duration_sec != null ? fmtTime(leg.duration_sec) : null]
                          .filter(Boolean).join(' · ')}
                      </Text>
                    </Box>
                  </HStack>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        )
      })}

      {result && (
        <Card.Root>
          <Card.Header><Text fontWeight="bold">AI Recommendation</Text></Card.Header>
          <Card.Body>
            <Text fontSize="sm" whiteSpace="pre-wrap">{result}</Text>
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  )
}
```

### FeedbackForm.jsx — Chakra form

```jsx
import { useState } from 'react'
import { Stack, HStack, Button, Textarea, Text, Card } from '@chakra-ui/react'
import { submitFeedback } from '../api'

export default function FeedbackForm({ payload, routes, result }) {
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [status, setStatus]   = useState('')

  async function handleSubmit() {
    const route = routes[0]
    const totalMin = Math.round(route.legs.reduce((s, l) => s + (l.duration_sec ?? 0), 0) / 60)

    try {
      const data = await submitFeedback({
        rating, comment,
        origin_lat:          payload.source.lat,
        origin_lng:          payload.source.lng,
        dest_lat:            payload.destination.lat,
        dest_lng:            payload.destination.lng,
        disability_type:     payload.disability_type,
        route_date:          payload.date,
        route_total_min:     totalMin,
        route_num_transfers: route.transfers ?? 0,
        route_modes:         route.legs.map(l => l.route ? `${l.mode} ${l.route}` : l.mode).join(' → '),
        recommendation:      result,
      })
      setStatus(`Thanks! Feedback saved (ID: ${data.id})`)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }

  return (
    <Card.Root>
      <Card.Header><Text fontWeight="bold">How was this route?</Text></Card.Header>
      <Card.Body>
        <Stack gap={3}>
          <HStack>
            {[1,2,3,4,5].map(n => (
              <Button key={n} size="sm" variant={rating === n ? 'solid' : 'outline'}
                colorPalette="yellow" onClick={() => setRating(n)}>
                {'★'.repeat(n)}
              </Button>
            ))}
          </HStack>
          <Textarea placeholder="Any comments?" value={comment}
            onChange={e => setComment(e.target.value)} rows={3} />
          <Button colorPalette="green" disabled={!rating} onClick={handleSubmit}>
            Submit Feedback
          </Button>
          {status && <Text fontSize="sm" color="green.600">{status}</Text>}
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
```

---

## 8. Run in Development

Two terminals:

```bash
# Terminal 1 — FastAPI backend
uvicorn main:app --reload --port 8000

# Terminal 2 — React dev server (proxies API calls to :8000)
cd frontend && npm run dev
```

Open `http://localhost:5173`. The Vite proxy forwards `/process`, `/stops`, and `/submit`
to FastAPI automatically — no CORS issues, no hardcoded URLs.

---

## 9. Production Build

When ready to ship, build the React app and tell FastAPI to serve it:

```bash
cd frontend && npm run build
# Outputs to frontend/dist/
```

Then update `main.py` to serve the built files:

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

FRONTEND = Path(__file__).parent / "frontend" / "dist"

# Mount static assets (JS, CSS, etc.)
app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

# Catch-all: serve index.html for any unmatched GET (client-side routing)
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    return FileResponse(FRONTEND / "index.html")
```

> Make sure the catch-all route is **after** all your API routes.

---

## 10. Chakra UI Tips for This Project

| Element in `index.html` | Chakra equivalent |
|---|---|
| `<select>` mobility aid | `Select` with `createListCollection` |
| Mode toggle buttons | `ButtonGroup` with `variant="outline"` |
| Leg colour sidebar | `Box borderLeft` + `Badge colorPalette` |
| Status text below button | `Text color="gray.500"` |
| Feedback form | `Card` + `Stack` + `Textarea` |
| Autocomplete dropdown | `List.Root` / `List.Item` in absolute `Box` |

---

## Summary of Changes to `main.py`

- No changes needed for development (CORS is already open).
- For production: add `StaticFiles` mount + SPA catch-all route (step 9 above).
- The `GET /` route that returns `FileResponse("index.html")` can be removed once
  the React build is being served instead.
