import { useState } from 'react'
import {
  Stack, HStack, Button, Select, Input, Field, createListCollection, Text
} from '@chakra-ui/react'
import Autocomplete from './Autocomplete'

const MOBILITY_AIDS = [
  'manual wheelchair', 'electric wheelchair', 'walker',
  'walking cane', 'mobility scooter', 'no mobility aid',
]

const mobilityAidCollection = createListCollection({
  items: MOBILITY_AIDS.map((aid) => ({
    label: aid,
    value: aid.toLowerCase(),
  })),
})

const ROUTE_LABELS = ['Recommended Route', 'Alternative 1', 'Alternative 2']

export default function ControlPanel({
  onPlan, loading,
  origin, destination, setOrigin, setDestination,
  mapClickMode, onToggleMapClick,
  routes, selectedRouteIdx, onRouteSelect,
}) {
  const [disabilityType, setDisabilityType] = useState('manual wheelchair')
  const [date, setDate] = useState('2026-04-15')

  function handleSubmit() {
    if (!origin || !destination) return
    onPlan({
      source:          { lat: origin.lat, lng: origin.lng },
      destination:     { lat: destination.lat, lng: destination.lng },
      disability_type: disabilityType,
      date,
    })
  }

  function toggleMode(mode) {
    onToggleMapClick(mapClickMode === mode ? null : mode)
  }

  return (
    <Stack gap={3}>
      <HStack>
        <Field.Root>
          <Field.Label>Mobility Aid</Field.Label>
          <Select.Root
            collection={mobilityAidCollection}
            value={[disabilityType]}
            onValueChange={({ value }) => setDisabilityType(value[0])}
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger bg="white">
                <Select.ValueText placeholder="Select mobility aid" />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Select.Positioner>
              <Select.Content>
                {mobilityAidCollection.items.map((item) => (
                  <Select.Item item={item} key={item.value}>
                    {item.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Field.Root>
        <Field.Root>
          <Field.Label>Date</Field.Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} bg="white" />
        </Field.Root>
      </HStack>

      <HStack align="flex-end">
        <Autocomplete
          label="Origin"
          onSelect={setOrigin}
          externalValue={origin}
        />
        <Button
          size="sm"
          px={2}
          variant={mapClickMode === 'origin' ? 'solid' : 'outline'}
          colorPalette={mapClickMode === 'origin' ? 'orange' : 'gray'}
          bg={mapClickMode === 'origin' ? undefined : 'white'}
          onClick={() => toggleMode('origin')}
          flexShrink={0}
          title="Click the map to set origin"
        >
          📍
        </Button>
      </HStack>

      <HStack align="flex-end">
        <Autocomplete
          label="Destination"
          onSelect={setDestination}
          externalValue={destination}
        />
        <Button
          size="sm"
          px={2}
          variant={mapClickMode === 'destination' ? 'solid' : 'outline'}
          colorPalette={mapClickMode === 'destination' ? 'orange' : 'gray'}
          bg={mapClickMode === 'destination' ? undefined : 'white'}
          onClick={() => toggleMode('destination')}
          flexShrink={0}
          title="Click the map to set destination"
        >
          📍
        </Button>
      </HStack>

      {mapClickMode && (
        <Text fontSize="sm" color="orange.600">
          Click anywhere on the map to set your {mapClickMode}.
        </Text>
      )}

      {routes?.length > 0 && (
        <Field.Root>
          <Field.Label>Viewing Route</Field.Label>
          <Select.Root
            collection={createListCollection({
              items: routes.map((_, i) => ({
                label: ROUTE_LABELS[i] ?? `Option ${i + 1}`,
                value: String(i),
              })),
            })}
            value={[String(selectedRouteIdx)]}
            onValueChange={({ value }) => onRouteSelect(Number(value[0]))}
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger bg="white">
                <Select.ValueText />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Select.Positioner>
              <Select.Content>
                {routes.map((_, i) => (
                  <Select.Item item={{ label: ROUTE_LABELS[i] ?? `Option ${i + 1}`, value: String(i) }} key={i}>
                    {ROUTE_LABELS[i] ?? `Option ${i + 1}`}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Field.Root>
      )}

      <Button
        colorPalette="blue"
        onClick={handleSubmit}
        loading={loading}
        disabled={!origin || !destination}
      >
        Plan Route
      </Button>
    </Stack>
  )
}