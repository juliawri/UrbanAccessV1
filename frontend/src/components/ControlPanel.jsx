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

export default function ControlPanel({
  onPlan, loading,
  origin, destination, onOriginChange, onDestinationChange,
  inputMode, onInputModeChange, mapClickStep, onResetMapClick,
}) {
  const [disabilityType, setDisabilityType] = useState(['manual wheelchair'])
  const [date, setDate] = useState('2026-04-15')

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
      bg="#C4D1DF"
    >
      {/* Mobility aid + date row */}
      <HStack align="flex-end" flexWrap="wrap" gap={3}>
        <Box flex="1" minW="200px" position="relative">
          <SelectRoot
            collection={aidCollection}
            value={disabilityType}
            onValueChange={({ value }) => setDisabilityType(value)}
          >
            <SelectLabel fontSize="sm" fontWeight="medium" color="black">Mobility Aid</SelectLabel>
            <SelectTrigger>
              <SelectValueText placeholder="Select…" color="black" />
            </SelectTrigger>
            <SelectContent zIndex={9999} position="absolute" top="100%" left={0} right={0}>
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
            variant={inputMode === m ? 'solid' : 'outline'}
            colorPalette="blue"
            onClick={() => onInputModeChange(m)}
          >
            {m === 'search' ? 'Search by address' : 'Click on map'}
          </Button>
        ))}
      </HStack>

      {/* Search inputs */}
      {inputMode === 'search' && (
        <Stack gap={2}>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1} color="black">Origin</Text>
            <Autocomplete label="Origin" onSelect={onOriginChange} />
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1} color="black">Destination</Text>
            <Autocomplete label="Destination" onSelect={onDestinationChange} />
          </Box>
        </Stack>
      )}

      {/* Map click status */}
      {inputMode === 'map' && (
        <Stack gap={2}>
          <Box fontSize="sm" p={2} bg="white" borderRadius="md" border="1px solid" borderColor="gray.200">
            {!origin && !destination && (
              <Text color="black">Click on the map to set your <strong>origin</strong>.</Text>
            )}
            {origin && !destination && (
              <Text color="black">Origin set. Now click to set your <strong>destination</strong>.</Text>
            )}
            {origin && destination && (
              <Text color="black">Both points set. Ready to plan!</Text>
            )}
          </Box>
          <HStack fontSize="sm" gap={4}>
            <Text color={origin ? 'green.700' : 'gray.500'}>
              {origin ? `Origin: ${origin.label}` : 'Origin: not set'}
            </Text>
            <Text color={destination ? 'green.700' : 'gray.500'}>
              {destination ? `Destination: ${destination.label}` : 'Destination: not set'}
            </Text>
          </HStack>
          <Button size="sm" variant="ghost" colorPalette="red" onClick={onResetMapClick} alignSelf="flex-start">
            Reset points
          </Button>
        </Stack>
      )}

      <Button
        colorPalette="blue"
        onClick={handleSubmit}
        loading={loading}
        loadingText="Planning route…"
        disabled={!origin || !destination}
      >
        Plan Route
      </Button>
    </Stack>
  )
}
