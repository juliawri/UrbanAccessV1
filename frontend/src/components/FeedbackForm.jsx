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
    <Card.Root bg="#F0FDFF" boxShadow="sm">
      <Card.Header><Text fontWeight="bold">How was this route?</Text></Card.Header>
      <Card.Body>
        <Stack gap={3}>
          <HStack>
            {[1,2,3,4,5].map(n => (
              <Button key={n} size="sm" variant={rating === n ? 'solid' : 'outline'}
                colorPalette="yellow" bg={rating === n ? undefined : 'white'} onClick={() => setRating(n)}>
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