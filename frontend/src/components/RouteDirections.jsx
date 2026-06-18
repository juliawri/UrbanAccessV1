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