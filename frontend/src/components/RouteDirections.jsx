import { Stack, HStack, Text, Badge, Box } from '@chakra-ui/react'

const MODE_COLOR = {
  WALK:   'blue',
  BUS:    'orange',
  SUBWAY: 'purple',
  TRAM:   'green',
}

const BORDER_COLOR = {
  WALK:   '#2196F3',
  BUS:    '#FF9800',
  SUBWAY: '#9C27B0',
  TRAM:   '#4CAF50',
}

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function fmtTime(sec) {
  const m = Math.round(sec / 60)
  return m < 1 ? '<1 min' : `${m} min`
}

const ROUTE_LABELS = ['Recommended Route', 'Alternative 1', 'Alternative 2']

export default function RouteDirections({ routes, result }) {
  return (
    <Stack gap={4}>
      {routes.map((route, idx) => {
        const totalMin = Math.round(
          route.legs.reduce((s, l) => s + (l.duration_sec ?? 0), 0) / 60
        )
        return (
          <Box
            key={idx}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="lg"
            overflow="hidden"
          >
            {/* Header */}
            <HStack
              justify="space-between"
              px={4}
              py={3}
              bg="gray.50"
              borderBottom="1px solid"
              borderColor="gray.200"
            >
              <Text fontWeight="bold">
                {ROUTE_LABELS[idx] ?? `Option ${idx + 1}`}
              </Text>
              <Text color="gray.500" fontSize="sm">{totalMin} min total</Text>
            </HStack>

            {/* Legs */}
            <Stack gap={2} p={3}>
              {route.legs.map((leg, li) => {
                const meta = [
                  leg.distance_m != null ? fmtDist(leg.distance_m) : null,
                  leg.duration_sec != null ? fmtTime(leg.duration_sec) : null,
                ].filter(Boolean).join(' · ')

                return (
                  <HStack
                    key={li}
                    p={2}
                    borderLeft="4px solid"
                    borderColor={BORDER_COLOR[leg.mode] ?? '#ccc'}
                    bg="gray.50"
                    borderRadius="0 4px 4px 0"
                    align="flex-start"
                    gap={3}
                  >
                    <Badge
                      colorPalette={MODE_COLOR[leg.mode] ?? 'gray'}
                      flexShrink={0}
                      mt="1px"
                    >
                      {leg.mode}
                    </Badge>
                    <Box fontSize="sm">
                      <Text>
                        {leg.from ?? '?'} → {leg.to ?? '?'}
                        {leg.route && (
                          <Text as="span" color="gray.500"> ({leg.route})</Text>
                        )}
                      </Text>
                      <Text color="gray.500" fontSize="xs">{meta}</Text>
                    </Box>
                  </HStack>
                )
              })}
            </Stack>
          </Box>
        )
      })}

      {/* AI recommendation text */}
      {result && (
        <Box
          border="1px solid"
          borderColor="blue.200"
          borderRadius="lg"
          overflow="hidden"
        >
          <Box px={4} py={3} bg="blue.50" borderBottom="1px solid" borderColor="blue.200">
            <Text fontWeight="bold" color="blue.800">AI Recommendation</Text>
          </Box>
          <Box px={4} py={3}>
            <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight={1.7}>{result}</Text>
          </Box>
        </Box>
      )}
    </Stack>
  )
}
