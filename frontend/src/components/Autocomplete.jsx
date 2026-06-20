import { useState, useCallback, useRef } from 'react'
import { Box, Input } from '@chakra-ui/react'
import { searchStops } from '../api'
import { useLanguage, useT } from '../LanguageContext'

function debounce(fn, ms) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

const BADGE_COLORS = {
  METRO: '#9C27B0', 
  BUS:   '#FF9800',
  ADDR:  '#607D8B',
  PLACE: '#388E3C',
}


export default function Autocomplete({ label, onSelect }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [open, setOpen]   = useState(false)
  const wrapperRef = useRef(null)
  const { lang } = useLanguage()
  const t = useT()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const search = useCallback(debounce(async (q, currentLang) => {
    if (q.length < 2) { setItems([]); setOpen(false); return }

    // Transit stops from the FastAPI backend
    const stops = await searchStops(q)
    const stopResults = stops.map(s => ({
      label: s.name,
      badge: s.type === 'metro_station' ? 'METRO' : 'BUS',
      lat: s.lat,
      lng: s.lon,
    }))

    // Photon geocoder for street addresses and named places
    const looksLikeAddress = /^\d/.test(q.trim())
    let placeResults = []
    let addrResults = []
    try {
      const photon = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&bbox=-74.1,45.2,-73.3,45.8&lang=${currentLang}`
      ).then(r => r.json())
      photon.features.forEach(f => {
        const p = f.properties
        const [lon, lat] = f.geometry.coordinates
        const num      = p.housenumber ? p.housenumber + ' ' : ''
        const street   = (num + (p.street || '')).trim()
        const cityLine = [p.city || p.district].filter(Boolean).join(', ')
        const fullAddr = [street, cityLine].filter(Boolean).join(', ')
        // Named POI/landmark: has a distinct name (not just the street name)
        const hasName = p.name && p.name.trim() && p.name !== p.street
        if (hasName && !looksLikeAddress) {
          placeResults.push({
            label: p.name.trim(),
            sub:   fullAddr,
            badge: 'PLACE',
            lat,
            lng: lon,
          })
        } else {
          // For street-type results, p.street is undefined and p.name holds the street name
          const streetPart = street || (!street && p.name ? p.name : '')
          const displayAddr = [streetPart, cityLine].filter(Boolean).join(', ')
          addrResults.push({
            label: displayAddr || q,
            badge: 'ADDR',
            lat,
            lng: lon,
          })
        }
      })
    } catch (_) {}

    // Places first for name searches, addresses first when query starts with a digit
    const geocoded = looksLikeAddress
      ? [...addrResults, ...placeResults]
      : [...placeResults, ...addrResults]

    setItems([...stopResults, ...geocoded])
    setOpen(true)
  }, 300), [])

  function handleSelect(item) {
    setQuery(item.label)
    setOpen(false)
    onSelect(item)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && items.length > 0) {
      handleSelect(items[0])
    }
  }

  return (
    <Box ref={wrapperRef} position="relative">
      <Input
        placeholder={t('autocomplete_placeholder')}
        value={query}
        color="white"
        style={{ color: 'white' }}
        _placeholder={{ color: 'white' }}
        onChange={e => {
          setQuery(e.target.value)
          onSelect(null)
          search(e.target.value, lang)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => { if (query.length >= 2) search(query, lang) }}
      />
      {open && items.length > 0 && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          width="100%"
          zIndex={9999}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          boxShadow="md"
          maxH="260px"
          overflowY="auto"
          mt="2px"
        >
          {items.map((item, i) => (
            <Box
              key={i}
              px={1}
              py="2px"
              cursor="pointer"
              fontSize="11px"
              color="gray.900"
              borderBottom="1px solid"
              borderColor="gray.100"
              _hover={{ bg: 'blue.50' }}
              onMouseDown={() => handleSelect(item)}
            >
              <Box
                as="span"
                display="inline-block"
                fontSize="8px"
                fontWeight="bold"
                px="3px"
                mr="3px"
                borderRadius="sm"
                color="white"
                bg={BADGE_COLORS[item.badge] ?? '#888'}
                verticalAlign="middle"
              >
                {item.badge}
              </Box>
              {item.label}
              {item.sub && (
                <Box fontSize="10px" color="gray.600" mt="0px">{item.sub}</Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
