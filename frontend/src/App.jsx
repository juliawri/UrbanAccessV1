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