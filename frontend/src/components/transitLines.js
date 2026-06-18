// STM Montréal transit line colors and route numbers.
// Colors sourced directly from the STM GTFS route_color field (same data Google Maps uses).
// Purple (#781B7D) = frequent service; Blue (#009EE0) = regular daytime service.
// `number` is used as a fallback for cached data that lacks route_short_name.
const LINES = {
  // Métro — official GTFS colors
  'Line 1 - Green':     { number: '1',   color: '#00B300' },
  'Line 2 - Orange':    { number: '2',   color: '#D95700' },
  'Line 4 - Yellow':    { number: '4',   color: '#FFD900' },
  'Line 5 - Blue':      { number: '5',   color: '#0095E6' },
  // Bus — GTFS colors: purple = frequent, blue = regular
  'Jean-Talon Est':     { number: '141', color: '#781B7D' }, // Fréquente
  'Girouard':           { number: '63',  color: '#009EE0' }, // Jour
  'Express Lacordaire': { number: '432', color: '#009EE0' }, // Jour
  'Saint-Laurent':      { number: '55',  color: '#781B7D' }, // Fréquente pointe
  'Sherbrooke':         { number: '24',  color: '#781B7D' }, // Fréquente
}

const MODE_FALLBACK = {
  WALK:   '#888888',
  BUS:    '#009EE0', // STM default bus blue
  SUBWAY: '#0095E6',
  TRAM:   '#009EE0',
}

/** Hex color for a leg border / badge */
export function getLegColor(mode, routeName) {
  if (routeName && LINES[routeName]) return LINES[routeName].color
  return MODE_FALLBACK[mode] ?? '#888'
}

/**
 * Display label for the badge on a transit leg.
 * Returns route short name (number) when available, otherwise mode.
 */
export function getLegBadgeLabel(mode) {
  if (mode === 'SUBWAY') return 'METRO'
  return mode
}

/**
 * Full display name for the route on a transit leg.
 * Buses get "number name" format; subway keeps its existing name.
 */
export function getLegRouteName(mode, routeName, routeShortName) {
  if (!routeName) return null
  if (mode === 'SUBWAY' || mode === 'TRAM') return routeName
  const number = routeShortName || LINES[routeName]?.number
  if (!number) return routeName
  // Avoid double-prefixing if name already starts with the number
  if (routeName.startsWith(number)) return routeName
  return `${number} ${routeName}`
}
