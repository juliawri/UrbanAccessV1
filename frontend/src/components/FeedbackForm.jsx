import { useState } from 'react'
import { Box, Stack, HStack, Button, Textarea, Text } from '@chakra-ui/react'
import { submitFeedback } from '../api'
import { supabase } from '../supabaseClient'

export default function FeedbackForm({ payload, routes, result, user }) {
  const [rating, setRating]   = useState(0)
  const [hover, setHover]     = useState(0)
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
    const legsSummary = route.legs
      .map(l => {
        const dist = l.distance_m >= 1000
          ? `${(l.distance_m / 1000).toFixed(1)} km`
          : `${Math.round(l.distance_m)} m`
        return `${l.route ? `${l.mode} ${l.route}` : l.mode}: ${l.from ?? '?'} → ${l.to ?? '?'} | ${dist}, ${Math.round((l.duration_sec ?? 0) / 60)} min`
      })
      .join('\n')

    try {
      let token = null
      if (user && supabase) {
        const { data: sessionData } = await supabase.auth.getSession()
        token = sessionData?.session?.access_token ?? null
      }

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
        route_legs_summary:  legsSummary,
        recommendation:      result,
      }, token)
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
      borderRadius="lg"
      overflow="hidden"
      width="100%"
      style={{ background: '#ffffff', border: '1px solid #d1d5db' }}
    >
      <Box px={4} py={3} style={{ background: '#ffffff', borderBottom: '1px solid #d1d5db' }}>
        <Text fontWeight="bold" color="#1f2937">How was this route?</Text>
      </Box>
      <Stack gap={3} p={4} style={{ background: '#ffffff' }}>
        {/* Auth context */}
        {user ? (
          <Text fontSize="sm" color="#6b7280">Submitting as <strong style={{ color: '#1f2937' }}>{user.email}</strong></Text>
        ) : (
          <Text fontSize="sm" color="#9ca3af">Submitting anonymously — <a href="#" onClick={e => { e.preventDefault(); document.querySelector('.navbar-auth-btn')?.click() }} style={{ color: '#1e3d3d', textDecoration: 'underline' }}>sign in</a> to associate feedback with your account.</Text>
        )}

        {/* Star rating */}
        <HStack onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => {
            const filled = rating >= n
            const hovered = hover >= n
            return (
              <Button
                key={n}
                size="sm"
                variant={filled ? 'solid' : 'outline'}
                colorPalette="yellow"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                fontSize="lg"
                minW={10}
                style={
                  filled
                    ? { background: '#f59e0b', color: '#1f2937', borderColor: '#f59e0b' }
                    : hovered
                    ? { borderColor: '#d1d5db', background: 'transparent', color: '#f59e0b' }
                    : { borderColor: '#d1d5db', color: '#4b5563' }
                }
              >
                ★
              </Button>
            )
          })}
          {rating > 0 && (
            <Text fontSize="sm" color="#374151">{rating} / 5</Text>
          )}
        </HStack>

        <Textarea
          placeholder="Any comments about accessibility on this route?"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          style={{ background: '#ffffff', color: '#1f2937', borderColor: '#d1d5db' }}
          _placeholder={{ color: '#9ca3af' }}
        />

        <Button
          colorPalette="green"
          onClick={handleSubmit}
          loading={loading}
          loadingText="Submitting…"
          disabled={!rating}
          style={{ opacity: 0.80 }}
        >
          Submit Feedback
        </Button>

        {status && (
          <Text
            fontSize="sm"
            color={status.startsWith('Error') ? '#dc2626' : '#16a34a'}
          >
            {status}
          </Text>
        )}
      </Stack>
    </Box>
  )
}
