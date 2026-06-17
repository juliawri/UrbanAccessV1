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
  const [error, setError] = useState('')

  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [inputMode, setInputMode] = useState('search')
  const [mapClickStep, setMapClickStep] = useState('origin')

  async function handlePlan(payload) {
    setLoading(true)
    setError('')
    setRoutes([])
    setResult('')
    try {
      const data = await planRoute(payload)
      setRoutes(data.routes)
      setResult(data.result)
      setLastPayload(payload)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleMapClick({ lat, lng }) {
    if (inputMode !== 'map') return
    const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    if (mapClickStep === 'origin') {
      setOrigin({ lat, lng, label })
      setMapClickStep('destination')
    } else {
      setDestination({ lat, lng, label })
    }
  }

  function handleInputModeChange(m) {
    setInputMode(m)
    setMapClickStep('origin')
    setOrigin(null)
    setDestination(null)
  }

  return (
    <Box p={4} bg="#FFF8EE" minH="100vh">
      <Heading size="lg" mb={4} color="black" textAlign="center">Urban Access</Heading>
      <Stack gap={4}>
        <ControlPanel
          onPlan={handlePlan}
          loading={loading}
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          inputMode={inputMode}
          onInputModeChange={handleInputModeChange}
          mapClickStep={mapClickStep}
          onResetMapClick={() => { setOrigin(null); setDestination(null); setMapClickStep('origin') }}
        />
        {error && (
          <Box bg="red.50" border="1px solid" borderColor="red.200" borderRadius="md" p={3} fontSize="sm" color="red.700">
            {error}
          </Box>
        )}
        <MapView
          routes={routes}
          onMapClick={handleMapClick}
          inputMode={inputMode}
          origin={origin}
          destination={destination}
        />
        {result && <RouteDirections routes={routes} result={result} />}
        {routes.length > 0 && lastPayload && (
          <FeedbackForm payload={lastPayload} routes={routes} result={result} />
        )}
      </Stack>
    </Box>
  )
}
