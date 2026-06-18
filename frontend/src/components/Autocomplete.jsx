import { useState, useCallback, useEffect } from 'react'
import { Box, Input, List } from '@chakra-ui/react'
import { searchStops } from '../api'

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

export default function Autocomplete({ label, onSelect, externalValue }) {
  const [query, setQuery]     = useState('')
  const [items, setItems]     = useState([])
  const [open, setOpen]       = useState(false)

  useEffect(() => {
    if (externalValue) {
      setQuery(externalValue.label)
      setItems([])
      setOpen(false)
    } else {
      setQuery('')
    }
  }, [externalValue])

  const search = useCallback(debounce(async (q) => {
    if (q.length < 2) { setItems([]); return }

    // Transit stops from backend
    const stops = await searchStops(q)
    const stopResults = stops.map(s => ({
      label: s.name,
      badge: s.type === 'metro_station' ? 'METRO' : 'BUS',
      lat: s.lat, lng: s.lon,
    }))

    // Photon geocoder for addresses
    const photon = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&bbox=-74.1,45.2,-73.3,45.8&lang=en`
    ).then(r => r.json()).catch(() => ({ features: [] }))

    const addrResults = photon.features.map(f => {
      const p = f.properties
      const [lon, lat] = f.geometry.coordinates
      return { label: p.name || p.street || q, badge: 'ADDR', lat, lng: lon }
    })

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
        placeholder={`${label} — address or transit stop…`}
        value={query}
        onChange={e => { setQuery(e.target.value); search(e.target.value); onSelect(null) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <List.Root
          position="absolute" zIndex={9000} bg="E6FBFF"
          border="1px solid" borderColor="gray.200" borderRadius="md"
          boxShadow="md" w="100%" maxH="240px" overflowY="auto"
        >
          {items.map((item, i) => (
            <List.Item
              key={i} px={3} py={2} cursor="pointer" fontSize="sm"
              _hover={{ bg: 'blue.50' }}
              onMouseDown={() => handleSelect(item)}
            >
              <Box as="span" fontWeight="bold" fontSize="xs" mr={2}
                bg="blue.500" color="E6FBFF" px={1} borderRadius="sm">
                {item.badge}
              </Box>
              {item.label}
            </List.Item>
          ))}
        </List.Root>
      )}
    </Box>
  )
}