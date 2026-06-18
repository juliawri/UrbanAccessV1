import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Stack, HStack, Text, Badge, Box } from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import { ROUTE_COLORS, ROUTE_LABELS } from './routeColors'
import { getLegColor, getLegBadgeLabel, getLegRouteName } from './transitLines'

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function fmtTime(sec) {
  const m = Math.round(sec / 60)
  return m < 1 ? '<1 min' : `${m} min`
}

function separateFields(text) {
  // Insert a blank line before each **Field:** line so markdown renders them as separate paragraphs
  return text.replace(/\n(\*\*)/g, '\n\n$1')
}

function parseRouteBlocks(result) {
  if (!result) return { blocks: ['', '', ''], confidence: '' }

  const labels = ['Recommended Route', 'Alternative 1', 'Alternative 2']
  const blocks = labels.map((label, i) => {
    const nextLabel = labels[i + 1]
    const pattern = nextLabel
      ? new RegExp(`##\\s*${label}\\s*\\n([\\s\\S]*?)(?=##\\s*${nextLabel})`, 'i')
      : new RegExp(`##\\s*${label}\\s*\\n([\\s\\S]*?)(?=\\*\\*Confidence:|$)`, 'i')
    const m = result.match(pattern)
    return m ? separateFields(m[1].trim()) : ''
  })

  const confMatch = result.match(/\*\*Confidence:\*\*[^\n]*/i)
  const confidence = confMatch ? confMatch[0] : ''

  return { blocks, confidence }
}

function RouteModal({ label, color, block, onClose }) {
  return createPortal(
    <div className="route-modal-backdrop" onClick={onClose}>
      <div
        className="route-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="route-modal-header" style={{ borderBottomColor: color }}>
          <span className="route-modal-title" style={{ color }}>{label}</span>
          <button className="route-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="route-modal-body md-result">
          <ReactMarkdown>{block}</ReactMarkdown>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function RouteDirections({ routes, result }) {
  const [modalIdx, setModalIdx] = useState(null)
  const { blocks, confidence } = parseRouteBlocks(result)

  return (
    <Stack gap={4}>
      <HStack gap={3} align="flex-start">
        {routes.map((route, idx) => {
          const totalMin = Math.round(
            route.legs.reduce((s, l) => s + (l.duration_sec ?? 0), 0) / 60
          )
          const block = blocks[idx]

          return (
            <Box
              key={idx}
              flex="1"
              minW="0"
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

                  const lineColor = getLegColor(leg.mode, leg.route)
                  const badgeLabel = getLegBadgeLabel(leg.mode)
                  const routeDisplay = leg.mode !== 'WALK'
                    ? getLegRouteName(leg.mode, leg.route, leg.route_short_name)
                    : null

                  return (
                    <HStack
                      key={li}
                      p={2}
                      borderLeft="4px solid"
                      borderColor={lineColor}
                      bg="gray.50"
                      borderRadius="0 4px 4px 0"
                      align="flex-start"
                      gap={3}
                    >
                      <Badge
                        flexShrink={0}
                        mt="1px"
                        style={{
                          backgroundColor: lineColor,
                          color: lineColor === '#FFD900' ? '#000' : '#fff',
                          fontWeight: 700,
                          fontSize: '11px',
                          padding: '2px 7px',
                          borderRadius: '4px',
                        }}
                      >
                        {badgeLabel}
                      </Badge>
                      <Box fontSize="sm">
                        <Text color="#1a1a1a">
                          {leg.from ?? '?'} → {leg.to ?? '?'}
                          {routeDisplay && (
                            <Text as="span" color="#333"> ({routeDisplay})</Text>
                          )}
                        </Text>
                        <Text color="#444" fontSize="xs">{meta}</Text>
                      </Box>
                    </HStack>
                  )
                })}
              </Stack>

              {block && (
                <Box px={3} pb={3} pt={2} borderTop="1px solid" borderColor="gray.100">
                  <button
                    className="learn-more-btn"
                    style={{ borderColor: ROUTE_COLORS[idx] ?? '#1e3d3d', color: ROUTE_COLORS[idx] ?? '#1e3d3d' }}
                    onClick={() => setModalIdx(idx)}
                  >
                    Learn More
                  </button>
                </Box>
              )}
            </Box>
          )
        })}
      </HStack>

      {confidence && (
        <Box
          px={4}
          py={3}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          fontSize="sm"
          color="#1a1a1a"
          className="md-result"
        >
          <ReactMarkdown>{confidence.replace(/\*\*Confidence:\*\*/i, '**Recommendation Confidence:**')}</ReactMarkdown>
        </Box>
      )}

      {modalIdx !== null && blocks[modalIdx] && (
        <RouteModal
          label={ROUTE_LABELS[modalIdx] ?? `Option ${modalIdx + 1}`}
          color={ROUTE_COLORS[modalIdx] ?? '#1e3d3d'}
          block={blocks[modalIdx]}
          onClose={() => setModalIdx(null)}
        />
      )}
    </Stack>
  )
}
