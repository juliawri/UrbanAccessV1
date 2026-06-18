import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Heading, Text, Spinner, Table } from '@chakra-ui/react'
import { getFeedback } from '../api'

function Stars({ rating }) {
  return (
    <span style={{ color: '#FE8E3C', fontSize: '16px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

export default function FeedbackPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getFeedback()
      .then(setRows)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Box w="100%" px={8} py={4}>
      <Heading
        mb={2}
        style={{
          fontFamily: "'Exo 2', sans-serif",
          fontSize: '60px',
          color: '#FE8E3C',
          fontWeight: 400,
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        Urban Access
      </Heading>

      <Box textAlign="center" mb={6}>
        <Link to="/" style={{ color: '#FE8E3C', fontSize: '14px', textDecoration: 'underline' }}>
          ← Back to planner
        </Link>
      </Box>

      <Heading size="md" mb={4} color="gray.700">
        User Feedback ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})
      </Heading>

      {loading && <Spinner color="orange.400" />}

      {error && (
        <Box bg="red.50" border="1px solid" borderColor="red.200" borderRadius="md" p={3} color="red.700" fontSize="sm">
          {error}
        </Box>
      )}

      {!loading && !error && rows.length === 0 && (
        <Text color="gray.500">No feedback submitted yet.</Text>
      )}

      {!loading && !error && rows.length > 0 && (
        <Box overflowX="auto">
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                {['ID', 'Rating', 'Comment', 'Mobility Aid', 'Date', 'Duration', 'Transfers', 'Modes', 'Origin', 'Destination'].map(h => (
                  <th key={h} style={{ border: '1px solid #ddd', padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={cell}>{r.id}</td>
                  <td style={cell}><Stars rating={r.rating} /></td>
                  <td style={{ ...cell, maxWidth: '220px', whiteSpace: 'pre-wrap' }}>{r.comment || '—'}</td>
                  <td style={cell}>{r.disability_type || '—'}</td>
                  <td style={cell}>{r.route_date || '—'}</td>
                  <td style={cell}>{r.route_total_min != null ? `${r.route_total_min} min` : '—'}</td>
                  <td style={cell}>{r.route_num_transfers ?? '—'}</td>
                  <td style={cell}>{r.route_modes || '—'}</td>
                  <td style={cell}>
                    {r.origin_lat != null ? `${r.origin_lat.toFixed(4)}, ${r.origin_lng.toFixed(4)}` : '—'}
                  </td>
                  <td style={cell}>
                    {r.dest_lat != null ? `${r.dest_lat.toFixed(4)}, ${r.dest_lng.toFixed(4)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  )
}

const cell = { border: '1px solid #ddd', padding: '7px 12px', verticalAlign: 'top' }
