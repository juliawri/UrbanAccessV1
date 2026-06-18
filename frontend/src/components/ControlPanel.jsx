import { useState } from 'react'
import {
  Box, Stack, HStack, Input, Text,
  createListCollection,
} from '@chakra-ui/react'
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectIndicator,
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

export default function ControlPanel({
  onPlan, loading,
  origin, destination, onOriginChange, onDestinationChange,
  inputMode, onInputModeChange, mapClickStep, onResetMapClick,
}) {
  const [disabilityType, setDisabilityType] = useState(['manual wheelchair'])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

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
      borderColor="rgba(255,255,255,0.15)"
      borderRadius="lg"
      bg="#1e3d3d"
      style={{ background: '#1e3d3d', borderRadius: '8px' }}
    >
      {/* Mobility aid + date row */}
      <HStack align="flex-end" flexWrap="wrap" gap={3}>
        <Box flex="1" minW="200px" position="relative">
          <SelectRoot
            collection={aidCollection}
            value={disabilityType}
            onValueChange={({ value }) => setDisabilityType(value)}
          >
            <SelectLabel fontSize="sm" fontWeight="medium" color="white">Mobility Aid</SelectLabel>
            <SelectTrigger>
              <SelectValueText placeholder="Select…" color="white" flex="1" style={{ color: 'white' }} />
              <SelectIndicator />
            </SelectTrigger>
            <SelectContent zIndex={9999} position="absolute" top="100%" left={0} right={0}>
              {MOBILITY_AIDS.map(a => (
                <SelectItem key={a.value} item={a}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </Box>

        <Box minW="160px">
          <Text fontSize="sm" fontWeight="medium" mb={1} color="white">Date</Text>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            color="white"
            style={{ color: 'white' }}
          />
        </Box>
      </HStack>

      {/* Mode toggle */}
      <HStack>
        {['search', 'map'].map(m => (
          <button
            key={m}
            onClick={() => onInputModeChange(m)}
            style={{
              fontSize: '14px',
              padding: '4px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.7)',
              background: inputMode === m ? '#d4722a' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {m === 'search' ? 'Search by address' : 'Click on map'}
          </button>
        ))}
      </HStack>

      {/* Search inputs */}
      {inputMode === 'search' && (
        <Stack gap={2}>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1} color="white">Origin</Text>
            <Autocomplete label="Origin" onSelect={onOriginChange} />
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1} color="white">Destination</Text>
            <Autocomplete label="Destination" onSelect={onDestinationChange} />
          </Box>
        </Stack>
      )}

      {/* Map click status */}
      {inputMode === 'map' && (
        <Stack gap={2}>
          <Box fontSize="sm" p={2} bg="rgba(0,0,0,0.15)" borderRadius="md" border="1px solid" borderColor="rgba(255,255,255,0.3)">
            {!origin && !destination && (
              <Text color="white">Click on the map to set your <strong>origin</strong>.</Text>
            )}
            {origin && !destination && (
              <Text color="white">Origin set. Now click to set your <strong>destination</strong>.</Text>
            )}
            {origin && destination && (
              <Text color="white">Both points set. Ready to plan!</Text>
            )}
          </Box>
          <HStack fontSize="sm" gap={4}>
            <Text color={origin ? '#a8f0b8' : 'rgba(255,255,255,0.55)'}>
              {origin ? `Origin: ${origin.label}` : 'Origin: not set'}
            </Text>
            <Text color={destination ? '#a8f0b8' : 'rgba(255,255,255,0.55)'}>
              {destination ? `Destination: ${destination.label}` : 'Destination: not set'}
            </Text>
          </HStack>
          <button
            onClick={onResetMapClick}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px 0',
              fontWeight: 500,
            }}
          >
            Reset points
          </button>
        </Stack>
      )}

      <button
        onClick={handleSubmit}
        disabled={!origin || !destination || loading}
        style={{
          background: !origin || !destination ? 'rgba(209,203,151,0.55)' : '#D1CB97',
          color: '#1e3d3d',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: !origin || !destination ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        {loading ? 'Planning route…' : 'Plan Route'}
      </button>
    </Stack>
  )
}
