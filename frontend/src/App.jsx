import { useState } from 'react'
import { Box, Flex, Stack } from '@chakra-ui/react'
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
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [mapClickMode, setMapClickMode] = useState(null) // 'origin' | 'destination' | null

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

  async function handleMapClick(latlng) {
    if (!mapClickMode) return
    let label = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/reverse?lat=${latlng.lat}&lon=${latlng.lng}&limit=1`
      )
      const data = await res.json()
      if (data.features?.length) {
        const p = data.features[0].properties
        label = [p.name, p.street, p.city].filter(Boolean).join(', ') || label
      }
    } catch {}
    const point = { lat: latlng.lat, lng: latlng.lng, label }
    if (mapClickMode === 'origin') setOrigin(point)
    else setDestination(point)
    setMapClickMode(null)
  }

  return (
    <Box p={4} bg="#E6FBFF" minH="100vh">
      <Stack gap={4}>
        <Flex gap={4} align="stretch">
          {/* Left sidebar panel */}
          <Box
            w="340px"
            flexShrink={0}
            bg="white"
            borderRadius="xl"
            p={4}
            boxShadow="sm"
            overflowY="auto"
            maxH="640px"
          >
            <ControlPanel
              onPlan={handlePlan}
              loading={loading}
              origin={origin}
              destination={destination}
              setOrigin={setOrigin}
              setDestination={setDestination}
              mapClickMode={mapClickMode}
              onToggleMapClick={setMapClickMode}
            />
          </Box>

          {/* Map */}
          <Box flex={1} borderRadius="xl" overflow="hidden" minH="640px">
            <MapView
              routes={routes}
              origin={origin}
              destination={destination}
              mapClickMode={mapClickMode}
              onMapClick={handleMapClick}
            />
          </Box>
        </Flex>

        {result && <RouteDirections routes={routes} result={result} />}
        {routes.length > 0 && (
          <FeedbackForm payload={lastPayload} routes={routes} result={result} />
        )}
      </Stack>
    </Box>
  )
}