import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Stack, HStack, Text, Badge, Box } from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import { ROUTE_COLORS } from './routeColors'
import { getLegColor, getLegBadgeLabel, getLegRouteName } from './transitLines'
import { useT, useLanguage } from '../LanguageContext'

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
  return text.replace(/\n(\*\*)/g, '\n\n$1')
}

// Parsing always uses English labels since the backend returns English markdown
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
      <div className="route-modal" onClick={e => e.stopPropagation()}>
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

const STREET_TYPE_FR = {
  street: 'Rue', st: 'Rue',
  avenue: 'Avenue', ave: 'Avenue',
  boulevard: 'Boulevard', blvd: 'Boulevard',
  road: 'Chemin', rd: 'Chemin',
  drive: 'Allée',
  place: 'Place',
  crescent: 'Croissant',
  terrace: 'Terrasse',
  lane: 'Ruelle',
  way: 'Voie',
  circle: 'Rond-Point',
  court: 'Cour',
}
const DIR_FR = { E: 'E', W: 'O', N: 'N', S: 'S' }

function localizeStreetName(raw, lang) {
  if (!raw) return raw
  const lower = raw.toLowerCase()
  if (lang !== 'fr') {
    if (lower === 'path') return 'a Path'
    if (lower === 'service road') return 'Service Road'
    return raw
  }
  if (lower === 'path') return 'un sentier'
  if (lower === 'service road') return 'voie de service'
  const parts = raw.trim().split(/\s+/)
  if (parts.length < 2) return raw
  const last = parts[parts.length - 1]
  const frDir = DIR_FR[last]
  const core = frDir ? parts.slice(0, -1) : parts
  const frType = STREET_TYPE_FR[core[core.length - 1].toLowerCase()]
  if (frType) {
    const name = core.slice(0, -1).join(' ')
    if (!name) return raw
    return frDir ? `${frType} ${name} ${frDir}` : `${frType} ${name}`
  }
  return raw
}

function RouteDetailsModal({ label, color, route, onClose }) {
  const t = useT()
  const { lang } = useLanguage()

  const DIRECTION_LABEL = {
    DEPART:                  t('dir_DEPART'),
    CONTINUE:                t('dir_CONTINUE'),
    LEFT:                    t('dir_LEFT'),
    RIGHT:                   t('dir_RIGHT'),
    SLIGHTLY_LEFT:           t('dir_SLIGHTLY_LEFT'),
    SLIGHTLY_RIGHT:          t('dir_SLIGHTLY_RIGHT'),
    HARD_LEFT:               t('dir_HARD_LEFT'),
    HARD_RIGHT:              t('dir_HARD_RIGHT'),
    UTURN_LEFT:              t('dir_UTURN_LEFT'),
    UTURN_RIGHT:             t('dir_UTURN_RIGHT'),
    CIRCLE_CLOCKWISE:        t('dir_CIRCLE_CLOCKWISE'),
    CIRCLE_COUNTERCLOCKWISE: t('dir_CIRCLE_COUNTERCLOCKWISE'),
    ELEVATOR:                t('dir_ELEVATOR'),
    ENTER_STATION:           t('dir_ENTER_STATION'),
    EXIT_STATION:            t('dir_EXIT_STATION'),
  }

  return createPortal(
    <div className="route-modal-backdrop" onClick={onClose}>
      <div className="route-modal" onClick={e => e.stopPropagation()}>
        <div className="route-modal-header" style={{ borderBottomColor: color }}>
          <span className="route-modal-title" style={{ color }}>{label} {t('step_by_step')}</span>
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
                          const street = localizeStreetName(rawStreet, lang)
                          const dist = step.distance_m > 0 ? fmtDist(step.distance_m) : null
                          const isWalk = dir === 'DEPART' || dir === 'CONTINUE'
                          const turnLabel = DIRECTION_LABEL[dir] ?? dir

                          return (
                            <li key={si} className="walk-substep">
                              {isWalk ? (
                                <>
                                  {t('walk_verb')} <span className="walk-substep-dist-inline">{dist ?? '—'}</span>
                                  {street && <>{t('walk_on')}<span className={step.bogus_name ? 'walk-street-dim' : 'walk-street'}>{street}</span></>}
                                </>
                              ) : (
                                <>
                                  <span className="walk-turn-label">{turnLabel}</span>
                                  {street && <> <span className={step.bogus_name ? 'walk-street-dim' : 'walk-street'}>{street}</span></>}
                                  {dist && <span className="walk-substep-dist">{t('then_walk')}{dist}</span>}
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

function localizeBlock(block, t, lang) {
  if (!block || lang !== 'fr') return block
  return block
    .replace(/\*\*Active Blockages:\*\*/g, `**${t('field_active_blockages')}:**`)
    .replace(/\*\*Street Photos:\*\*/g, `**${t('field_street_photos')}:**`)
    .replace(/\*\*Detailed Photo Review:\*\*/g, `**${t('field_detailed_photo')}:**`)
    .replace(/\*\*Traffic Safety:\*\*/g, `**${t('field_traffic_safety')}:**`)
    .replace(/\*\*Construction:\*\*/g, `**${t('field_construction')}:**`)
    .replace(/\*\*Heat & Shade:\*\*/g, `**${t('field_heat_shade')}:**`)
    .replace(/\*\*Summary:\*\*/g, `**${t('field_summary')}:**`)
}

export default function RouteDirections({ routes, result }) {
  const [modalIdx, setModalIdx] = useState(null)
  const [detailIdx, setDetailIdx] = useState(null)
  const [expandedCards, setExpandedCards] = useState([false, false, false])
  const { blocks, confidence } = parseRouteBlocks(result)
  const t = useT()
  const { lang } = useLanguage()

  const ROUTE_LABELS = [t('route_recommended'), t('route_alt1'), t('route_alt2')]

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
                  {ROUTE_LABELS[idx] ?? `${t('option')} ${idx + 1}`}
                </Text>
                <Box textAlign="right">
                  {departTime && (
                    <Text fontSize="sm" fontWeight="semibold" color="#1a1a1a">{t('leave_at')} {departTime}</Text>
                  )}
                  <Text color="#444" fontSize="xs">
                    {totalMin} min{arriveTime ? ` · ${t('arrive')} ${arriveTime}` : ''}
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
                        <Box px={2} py="3px" fontSize="xs" color="#888" fontStyle="italic">
                          ⏱ {t('wait')} {waitMin} min
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
                    {isExpanded ? t('see_less') : t('see_more')}
                  </button>
                )}
              </Stack>

              <Box px={3} pb={3} pt={2} borderTop="1px solid" borderColor="gray.100" display="flex" flexDirection="column" gap={2}>
                <button
                  className="learn-more-btn"
                  style={{ borderColor: ROUTE_COLORS[idx] ?? '#1e3d3d', color: ROUTE_COLORS[idx] ?? '#1e3d3d' }}
                  onClick={() => setDetailIdx(idx)}
                >
                  {t('more_details')}
                </button>
                {block && (
                  <button
                    className="learn-more-btn"
                    style={{ borderColor: ROUTE_COLORS[idx] ?? '#1e3d3d', color: ROUTE_COLORS[idx] ?? '#1e3d3d' }}
                    onClick={() => setModalIdx(idx)}
                  >
                    {t('accessibility_analysis')}
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
          <ReactMarkdown>{confidence.replace(/\*\*Confidence:\*\*/i, t('recommendation_confidence'))}</ReactMarkdown>
        </Box>
      )}

      {modalIdx !== null && blocks[modalIdx] && (
        <RouteModal
          label={ROUTE_LABELS[modalIdx] ?? `${t('option')} ${modalIdx + 1}`}
          color={ROUTE_COLORS[modalIdx] ?? '#1e3d3d'}
          block={localizeBlock(blocks[modalIdx], t, lang)}
          onClose={() => setModalIdx(null)}
        />
      )}

      {detailIdx !== null && routes[detailIdx] && (
        <RouteDetailsModal
          label={ROUTE_LABELS[detailIdx] ?? `${t('option')} ${detailIdx + 1}`}
          color={ROUTE_COLORS[detailIdx] ?? '#1e3d3d'}
          route={routes[detailIdx]}
          onClose={() => setDetailIdx(null)}
        />
      )}
    </Stack>
  )
}
