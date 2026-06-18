import { useState } from 'react'
import {
  Stack, HStack, Button, Select, Input, Field
} from '@chakra-ui/react'
import Autocomplete from './Autocomplete'

const MOBILITY_AIDS = [
  'Manual Wheelchair', 'Electric Wheelchair', 'Walker',
  'Walking Cane', 'Mobility Scooter', 'No Mobility Aid',
]

export default function ControlPanel({ onPlan, loading }) {
  const [disabilityType, setDisabilityType] = useState('manual wheelchair')
  const [date, setDate] = useState('2026-04-15')
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)

  function handleSubmit() {
    if (!origin || !destination) return
    onPlan({
      source:          { lat: origin.lat, lng: origin.lng },
      destination:     { lat: destination.lat, lng: destination.lng },
      disability_type: disabilityType,
      date,
    })
  }

  return (
    <Stack gap={3}>
      <HStack>
        <Field.Root label="Mobility Aid">
          <Select.Root
            value={disabilityType}
            onValueChange={({ value }) => setDisabilityType(value[0])}
            collection={/* use createListCollection */ null}
          >
            {/* see Chakra Select docs for collection setup */}
          </Select.Root>
        </Field.Root>
        <Field.Root label="Date">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field.Root>
      </HStack>

      <Autocomplete label="Origin"      onSelect={setOrigin} />
      <Autocomplete label="Destination" onSelect={setDestination} />

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