import { useState } from 'react'
import { Box, Stack, HStack, Button, Textarea, Text } from '@chakra-ui/react'
import { submitFeedback } from '../api'

export default function FeedbackForm({ payload, routes, result }) {
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(false)

  
  async function handleSubmit() {
    if (!rating) return
    setLoading(true)
    setStatus('')

    const route = routes[0]
    const totalMin = Math.round(
      route.legs.reduce((s, l) => s + (l.duration_sec ?? 0), 0) / 60
    )
    const modes = route.legs
      .map(l => (l.route ? `${l.mode} ${l.route}` : l.mode))
      .join(' → ')
    const legsSummary = route.legs
      .map(l => {
        const dist = l.distance_m >= 1000
          ? `${(l.distance_m / 1000).toFixed(1)} km`
          : `${Math.round(l.distance_m)} m`
        return `${l.route ? `${l.mode} ${l.route}` : l.mode}: ${l.from ?? '?'} → ${l.to ?? '?'} | ${dist}, ${Math.round((l.duration_sec ?? 0) / 60)} min`
      })
      .join('\n')

    try {
      const data = await submitFeedback({
        rating,
        comment,
        origin_lat:          payload.source.lat,
        origin_lng:          payload.source.lng,
        dest_lat:            payload.destination.lat,
        dest_lng:            payload.destination.lng,
        disability_type:     payload.disability_type,
        route_date:          payload.date,
        route_total_min:     totalMin,
        route_num_transfers: route.transfers ?? 0,
        route_modes:         modes,
        route_legs_summary:  legsSummary,
        recommendation:      result,
      })
      setStatus(`Thanks! Feedback saved (ID: ${data.id})`)
      setRating(0)
      setComment('')
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      overflow="hidden"
    >
      <Box px={4} py={3} bg="gray.50" borderBottom="1px solid" borderColor="gray.200">
        <Text fontWeight="bold">How was this route?</Text>
      </Box>
      <Stack gap={3} p={4}>
        {/* Star rating */}
        <HStack>
          {[1, 2, 3, 4, 5].map(n => (
            <Button
              key={n}
              size="sm"
              variant={rating >= n ? 'solid' : 'outline'}
              colorPalette="yellow"
              onClick={() => setRating(n)}
              fontSize="lg"
              minW={10}
            >
              ★
            </Button>
          ))}
          {rating > 0 && (
            <Text fontSize="sm" color="gray.500">{rating} / 5</Text>
          )}
        </HStack>

        <Textarea
          placeholder="Any comments about accessibility on this route?"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />

        <Button
          colorPalette="green"
          onClick={handleSubmit}
          loading={loading}
          loadingText="Submitting…"
          disabled={!rating}
        >
          Submit Feedback
        </Button>

        {status && (
          <Text
            fontSize="sm"
            color={status.startsWith('Error') ? 'red.600' : 'green.600'}
          >
            {status}
          </Text>
        )}
      </Stack>
    </Box>
  )
}
