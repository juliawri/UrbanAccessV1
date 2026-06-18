import { Stack, HStack, Text, Badge, Box } from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import { ROUTE_COLORS, ROUTE_LABELS } from './routeColors'

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

function normalizeRouteLabels(text) {
  return text
    .replace(/\bRoute\s*1\b/gi, 'Recommended Route')
    .replace(/\bRoute\s*2\b/gi, 'Alternative 1')
    .replace(/\bRoute\s*3\b/gi, 'Alternative 2')
}

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
            bg="white"
          >
            <HStack
              justify="space-between"
              px={4}
              py={3}
              bg="white"
              borderBottom="2px solid"
              borderColor={ROUTE_COLORS[idx] ?? 'gray.200'}
            >
              <Text fontWeight="bold" color={ROUTE_COLORS[idx] ?? '#1a1a1a'}>
                {ROUTE_LABELS[idx] ?? `Option ${idx + 1}`}
              </Text>
              <Text color="#555" fontSize="sm">{totalMin} min total</Text>
            </HStack>

            <Stack gap={2} p={3} bg="white">
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
                      <Text color="#1a1a1a">
                        {leg.from ?? '?'} → {leg.to ?? '?'}
                        {leg.route && (
                          <Text as="span" color="#333"> ({leg.route})</Text>
                        )}
                      </Text>
                      <Text color="#444" fontSize="xs">{meta}</Text>
                    </Box>
                  </HStack>
                )
              })}
            </Stack>
          </Box>
        )
      })}

      {result && (
        <Box
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          overflow="hidden"
          bg="white"
        >
          <Box px={4} py={3} bg="white" borderBottom="1px solid" borderColor="gray.200">
            <Text fontWeight="bold" color="#1a1a1a">AI Recommendation</Text>
          </Box>
          <Box px={4} py={3} fontSize="sm" lineHeight={1.7} color="#1a1a1a" className="md-result">
            <ReactMarkdown>{normalizeRouteLabels(result)}</ReactMarkdown>
          </Box>
        </Box>
      )}
    </Stack>
  )
}
