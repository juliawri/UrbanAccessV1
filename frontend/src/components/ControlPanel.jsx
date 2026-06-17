import { useState } from 'react'
import {
  Box, Stack, HStack, Button, Input, Text,
  createListCollection,
} from '@chakra-ui/react'
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from '@chakra-ui/react/select'
import Autocomplete from './Autocomplete'

const MOBILITY_AIDS = [
  { label: 'Manual Wheelchair',   value: 'manual wheelchair' },
  { label: 'Electric Wheelchair', value: 'electric wheelchair' },
  { label: 'Walker',              value: 'walker' },
  { label: 'Walking Cane',        value: 'walking cane' },
  { label: 'Mobility Scooter',    value: 'mobility scooter' },
  { label: 'No Mobility Aid',     value: 'no mobility aid' },
]

const aidCollection = createListCollection({ items: MOBILITY_AIDS })

export default function ControlPanel({ onPlan, loading }) {
  const [disabilityType, setDisabilityType] = useState(['manual wheelchair'])
  const [date, setDate]           = useState('2026-04-15')
  const [origin, setOrigin]       = useState(null)
  const [destination, setDest]    = useState(null)
  const [mode, setMode]           = useState('search') // 'search' | 'map'

  function handleSubmit() {
    if (!origin || !destination) return
    onPlan({
      source:          { lat: origin.lat, lng: origin.lng },
      destination:     { lat: destination.lat, lng: destination.lng },
      disability_type: disabilityType[0],
      date,
    })
  }

  return (
    <Stack
      gap={3}
      p={4}
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      bg="white"
    >
      {/* Mobility aid + date row */}
      <HStack align="flex-end" flexWrap="wrap" gap={3}>
        <Box flex="1" minW="200px">
          <SelectRoot
            collection={aidCollection}
            value={disabilityType}
            onValueChange={({ value }) => setDisabilityType(value)}
          >
            <SelectLabel fontSize="sm" fontWeight="medium">Mobility Aid</SelectLabel>
            <SelectTrigger>
              <SelectValueText placeholder="Select…" />
            </SelectTrigger>
            <SelectContent zIndex={9999}>
              {MOBILITY_AIDS.map(a => (
                <SelectItem key={a.value} item={a}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </Box>

        <Box minW="160px">
          <Text fontSize="sm" fontWeight="medium" mb={1}>Date</Text>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </Box>
      </HStack>

      {/* Mode toggle */}
      <HStack>
        {['search', 'map'].map(m => (
          <Button
            key={m}
            size="sm"
            variant={mode === m ? 'solid' : 'outline'}
            colorPalette="blue"
            onClick={() => setMode(m)}
          >
            {m === 'search' ? 'Search by address' : 'Click on map'}
          </Button>
        ))}
      </HStack>

      {/* Search inputs */}
      {mode === 'search' && (
        <Stack gap={2}>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>Origin</Text>
            <Autocomplete label="Origin" onSelect={setOrigin} />
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>Destination</Text>
            <Autocomplete label="Destination" onSelect={setDest} />
          </Box>
        </Stack>
      )}

      {mode === 'map' && (
        <Box fontSize="sm" color="gray.500" p={2} bg="gray.50" borderRadius="md">
          Click-on-map mode: use the map below to set your origin and destination.
        </Box>
      )}

      <Button
        colorPalette="blue"
        onClick={handleSubmit}
        loading={loading}
        loadingText="Planning route…"
        disabled={mode === 'search' && (!origin || !destination)}
      >
        Plan Route
      </Button>
    </Stack>
  )
}
