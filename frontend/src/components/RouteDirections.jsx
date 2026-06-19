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
function fmtTimestamp(ms) {
  if (!ms) return null
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
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

const STEP_ICON = { WALK: '🚶', SUBWAY: '🚇', BUS: '🚌', TRAM: '🚋' }

const DIRECTION_LABEL = {
  DEPART:                   'Head',
  CONTINUE:                 'Continue on',
  LEFT:                     'Turn left onto',
  RIGHT:                    'Turn right onto',
  SLIGHTLY_LEFT:            'Slight left onto',
  SLIGHTLY_RIGHT:           'Slight right onto',
  HARD_LEFT:                'Sharp left onto',
  HARD_RIGHT:               'Sharp right onto',
  UTURN_LEFT:               'U-turn onto',
  UTURN_RIGHT:              'U-turn onto',
  CIRCLE_CLOCKWISE:         'Follow roundabout onto',
  CIRCLE_COUNTERCLOCKWISE:  'Follow roundabout onto',
  ELEVATOR:                 'Take elevator to',
  ENTER_STATION:            'Enter station',
  EXIT_STATION:             'Exit station',
}


function RouteDetailsModal({ label, color, route, onClose }) {
  return createPortal(
    <div className="route-modal-backdrop" onClick={onClose}>
      <div className="route-modal" onClick={e => e.stopPropagation()}>
        <div className="route-modal-header" style={{ borderBottomColor: color }}>
          <span className="route-modal-title" style={{ color }}>{label} — Step-by-Step</span>
          <button className="route-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="route-modal-body">
          <ol className="route-steps">
            {route.legs.map((leg, li) => {
              const lineColor = getLegColor(leg.mode, leg.route)
              const badgeLabel = getLegBadgeLabel(leg.mode)
              const routeDisplay = leg.mode !== 'WALK'
                ? getLegRouteName(leg.mode, leg.route, leg.route_short_name)
                : null
              const departTime = fmtTimestamp(leg.start_time)
              const arriveTime = fmtTimestamp(leg.end_time)
              const meta = [
                leg.distance_m != null ? fmtDist(leg.distance_m) : null,
                leg.duration_sec != null ? fmtTime(leg.duration_sec) : null,
              ].filter(Boolean).join(' · ')

              return (
                <li key={li} className="route-step">
                  <div className="route-step-dot" style={{ background: lineColor }} />
                  {li < route.legs.length - 1 && <div className="route-step-line" style={{ background: lineColor }} />}
                  <div className="route-step-body">
                    <div className="route-step-top">
                      <span
                        className="route-step-badge"
                        style={{
                          background: lineColor,
                          color: lineColor === '#FFD900' ? '#000' : '#fff',
                        }}
                      >
                        {badgeLabel}
                      </span>
                      {routeDisplay && (
                        <span className="route-step-route">{routeDisplay}</span>
                      )}
                    </div>
                    <div className="route-step-stops">
                      <strong>{leg.from ?? '?'}</strong>
                      <span className="route-step-arrow">→</span>
                      <strong>{leg.to ?? '?'}</strong>
                    </div>
                    <div className="route-step-meta">
                      {departTime && arriveTime && (
                        <span>{departTime} – {arriveTime}</span>
                      )}
                      {meta && <span>{meta}</span>}
                    </div>
                    {leg.mode === 'WALK' && leg.walk_steps && leg.walk_steps.length > 0 && (
                      <ol className="walk-substeps">
                        {leg.walk_steps.map((step, si) => {
                          const dir = step.direction
                          const rawStreet = step.street || ''
                          const street = rawStreet.toLowerCase() === 'path'
                            ? 'a Path'
                            : rawStreet.toLowerCase() === 'service road'
                            ? 'Service Road'
                            : rawStreet
                          const dist = step.distance_m > 0 ? fmtDist(step.distance_m) : null
                          const isWalk = dir === 'DEPART' || dir === 'CONTINUE'
                          const turnLabel = DIRECTION_LABEL[dir] ?? dir

                          return (
                            <li key={si} className="walk-substep">
                              {isWalk ? (
                                <>
                                  Walk <span className="walk-substep-dist-inline">{dist ?? '—'}</span>
                                  {street && <> on <span className={step.bogus_name ? 'walk-street-dim' : 'walk-street'}>{street}</span></>}
                                </>
                              ) : (
                                <>
                                  <span className="walk-turn-label">{turnLabel}</span>
                                  {street && <> <span className={step.bogus_name ? 'walk-street-dim' : 'walk-street'}>{street}</span></>}
                                  {dist && <span className="walk-substep-dist">, then walk {dist}</span>}
                                </>
                              )}
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function RouteDirections({ routes, result }) {
  const [modalIdx, setModalIdx] = useState(null)
  const [detailIdx, setDetailIdx] = useState(null)
  const [expandedCards, setExpandedCards] = useState([false, false, false])
  const { blocks, confidence } = parseRouteBlocks(result)

  return (
    <Stack gap={4}>
      <HStack gap={3} align="flex-start" flexWrap="wrap">
        {routes.map((route, idx) => {
          const totalMin = Math.round(
            route.legs.reduce((s, l) => s + (l.duration_sec ?? 0), 0) / 60
          )
          const block = blocks[idx]
          const departTime = fmtTimestamp(route.legs[0]?.start_time)
          const arriveTime = fmtTimestamp(route.legs[route.legs.length - 1]?.end_time)
          const PREVIEW = 3
          const isExpanded = expandedCards[idx]
          const visibleLegs = (!isExpanded && route.legs.length > PREVIEW) ? route.legs.slice(0, PREVIEW) : route.legs
          const hiddenCount = route.legs.length - PREVIEW

          return (
            <Box
              key={idx}
              flex="1"
              minW="280px"
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
                <Box textAlign="right">
                  {departTime && (
                    <Text fontSize="sm" fontWeight="semibold" color="#1a1a1a">Leave at {departTime}</Text>
                  )}
                  <Text color="#444" fontSize="xs">
                    {totalMin} min{arriveTime ? ` · arrive ${arriveTime}` : ''}
                  </Text>
                </Box>
              </HStack>

              <Stack gap={2} p={3} bg="white">
                {visibleLegs.map((leg, li) => {
                  const meta = [
                    leg.distance_m != null ? fmtDist(leg.distance_m) : null,
                    leg.duration_sec != null ? fmtTime(leg.duration_sec) : null,
                  ].filter(Boolean).join(' · ')

                  const lineColor = getLegColor(leg.mode, leg.route)
                  const badgeLabel = getLegBadgeLabel(leg.mode)
                  const routeDisplay = leg.mode !== 'WALK'
                    ? getLegRouteName(leg.mode, leg.route, leg.route_short_name)
                    : null

                  const nextLeg = route.legs[li + 1]
                  const waitMs = nextLeg ? (nextLeg.start_time ?? 0) - (leg.end_time ?? 0) : 0
                  const waitMin = Math.round(waitMs / 60000)

                  return (
                    <Box key={li}>
                      <HStack
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
                      {waitMin >= 1 && li < visibleLegs.length - 1 && (
                        <Box
                          px={2}
                          py="3px"
                          fontSize="xs"
                          color="#888"
                          fontStyle="italic"
                        >
                          ⏱ Wait {waitMin} min
                        </Box>
                      )}
                    </Box>
                  )
                })}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setExpandedCards(prev => prev.map((v, i) => i === idx ? !v : v))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: ROUTE_COLORS[idx] ?? '#1e3d3d',
                      cursor: 'pointer',
                      fontSize: '15px',
                      padding: '2px 0',
                      textAlign: 'left',
                      fontWeight: 600,
                    }}
                  >
                    {isExpanded ? '▲ See Less' : '▼ See More'}
                  </button>
                )}
              </Stack>

              <Box px={3} pb={3} pt={2} borderTop="1px solid" borderColor="gray.100" display="flex" flexDirection="column" gap={2}>
                <button
                  className="learn-more-btn"
                  style={{ borderColor: ROUTE_COLORS[idx] ?? '#1e3d3d', color: ROUTE_COLORS[idx] ?? '#1e3d3d' }}
                  onClick={() => setDetailIdx(idx)}
                >
                  More Route Details
                </button>
                {block && (
                  <button
                    className="learn-more-btn"
                    style={{ borderColor: ROUTE_COLORS[idx] ?? '#1e3d3d', color: ROUTE_COLORS[idx] ?? '#1e3d3d' }}
                    onClick={() => setModalIdx(idx)}
                  >
                    Accessibility Analysis
                  </button>
                )}
              </Box>
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

      {detailIdx !== null && routes[detailIdx] && (
        <RouteDetailsModal
          label={ROUTE_LABELS[detailIdx] ?? `Option ${detailIdx + 1}`}
          color={ROUTE_COLORS[detailIdx] ?? '#1e3d3d'}
          route={routes[detailIdx]}
          onClose={() => setDetailIdx(null)}
        />
      )}
    </Stack>
  )
}
