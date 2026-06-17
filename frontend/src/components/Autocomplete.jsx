import { useState, useCallback } from 'react'
import { Box, Input } from '@chakra-ui/react'
import { searchStops } from '../api'

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const search = useCallback(debounce(async (q) => {
    if (q.length < 2) { setItems([]); setOpen(false); return }

    // Transit stops from the FastAPI backend
    const stops = await searchStops(q)
    const stopResults = stops.map(s => ({
      label: s.name,
      badge: s.type === 'metro_station' ? 'METRO' : 'BUS',
      lat: s.lat,
      lng: s.lon,
    }))

    // Photon geocoder for street addresses
    let addrResults = []
    try {
      const photon = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&bbox=-74.1,45.2,-73.3,45.8&lang=en`
      ).then(r => r.json())
      addrResults = photon.features.map(f => {
        const p = f.properties
        const [lon, lat] = f.geometry.coordinates
        const num  = p.housenumber ? p.housenumber + ' ' : ''
        const street = (num + (p.street || '')).trim()
        const hasName = p.name && p.name.trim() && p.name !== p.street
        return {
          label: hasName ? p.name.trim() : street || p.name || q,
          sub:   [p.city || p.district, p.postcode].filter(Boolean).join(', '),
          badge: hasName ? 'PLACE' : 'ADDR',
          lat,
          lng: lon,
        }
      })
    } catch (_) {}

    setItems([...stopResults, ...addrResults])
    setOpen(true)
  }, 300), [])

  function handleSelect(item) {
    setQuery(item.label)
    setOpen(false)
    onSelect(item)
  }

  return (
    <Box position="relative">
      <Input
        placeholder={`${label} — address or transit stop in Montreal…`}
        value={query}
        color="black"
        onChange={e => {
          setQuery(e.target.value)
          onSelect(null)
          search(e.target.value)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => { if (query.length >= 2) search(query) }}
      />

      {open && items.length > 0 && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={9000}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          boxShadow="md"
          maxH="260px"
          overflowY="auto"
        >
          {items.map((item, i) => (
            <Box
              key={i}
              px={3}
              py={2}
              cursor="pointer"
              fontSize="sm"
              borderBottom="1px solid"
              borderColor="gray.100"
              _hover={{ bg: 'blue.50' }}
              onMouseDown={() => handleSelect(item)}
            >
              <Box
                as="span"
                display="inline-block"
                fontSize="10px"
                fontWeight="bold"
                px={1}
                mr={2}
                borderRadius="sm"
                color="white"
                bg={BADGE_COLORS[item.badge] ?? '#888'}
                verticalAlign="middle"
              >
                {item.badge}
              </Box>
              {item.label}
              {item.sub && (
                <Box fontSize="11px" color="gray.500" mt="1px">{item.sub}</Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
