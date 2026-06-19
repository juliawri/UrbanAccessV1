import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Heading, Text, Spinner } from '@chakra-ui/react'
import { getFeedback } from '../api'

const COLUMNS = ['ID', 'User', 'Rating', 'Comment', 'Mobility Aid', 'Date', 'Duration', 'Transfers', 'Route Vector', 'Origin', 'Destination']

function Stars({ rating }) {
  return (
    <span style={{ color: '#FE8E3C', fontSize: '16px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function FeedbackRow({ r, i }) {
  const userLabel = r.user_id ? `User ${r.user_id.slice(0, 8)}` : 'anon'
  return (
    <tr style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
      <td style={cell}>{r.id}</td>
      <td style={{ ...cell, fontFamily: 'monospace', fontSize: '12px' }}>{userLabel}</td>
      <td style={cell}><Stars rating={r.rating} /></td>
      <td style={{ ...cell, maxWidth: '220px', whiteSpace: 'pre-wrap' }}>{r.comment || '—'}</td>
      <td style={cell}>{r.disability_type || '—'}</td>
      <td style={cell}>{r.route_date || '—'}</td>
      <td style={cell}>{r.route_total_min != null ? `${r.route_total_min} min` : '—'}</td>
      <td style={cell}>{r.route_num_transfers ?? '—'}</td>
      <td style={{ ...cell, color: r.route_embedding ? '#16a34a' : '#9ca3af', fontSize: '11px' }}>
        {r.route_embedding ? '✓ 384-dim' : '—'}
      </td>
      <td style={cell}>
        {r.origin_lat != null ? `${r.origin_lat.toFixed(4)}, ${r.origin_lng.toFixed(4)}` : '—'}
      </td>
      <td style={cell}>
        {r.dest_lat != null ? `${r.dest_lat.toFixed(4)}, ${r.dest_lng.toFixed(4)}` : '—'}
      </td>
    </tr>
  )
}

function FeedbackTable({ rows }) {
  return (
    <Box overflowX="auto" mb={6}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            {COLUMNS.map(h => (
              <th key={h} style={{ border: '1px solid #ddd', padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap', color: '#111827', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <FeedbackRow key={r.id} r={r} i={i} />)}
        </tbody>
      </table>
    </Box>
  )
}

function groupByUser(rows) {
  const byUser = {}
  const anonymous = []
  for (const r of rows) {
    if (r.user_id) {
      if (!byUser[r.user_id]) byUser[r.user_id] = []
      byUser[r.user_id].push(r)
    } else {
      anonymous.push(r)
    }
  }
  return { byUser, anonymous }
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

  const { byUser, anonymous } = groupByUser(rows)
  const userIds = Object.keys(byUser).sort()

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

      <Heading size="md" mb={6} style={{ color: '#111827' }}>
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

      {/* One table per registered user */}
      {!loading && !error && userIds.map(uid => (
        <Box key={uid} mb={8}>
          <div style={sectionHeader}>
            <span style={userIcon}>👤</span>
            <span style={{ ...sectionTitle, fontFamily: 'monospace' }}>User {uid.slice(0, 8)}</span>
            <span style={badge}>{byUser[uid].length} {byUser[uid].length === 1 ? 'entry' : 'entries'}</span>
          </div>
          <FeedbackTable rows={byUser[uid]} />
        </Box>
      ))}

      {/* Anonymous feedback */}
      {!loading && !error && anonymous.length > 0 && (
        <Box mb={8}>
          <div style={sectionHeader}>
            <span style={userIcon}>👤</span>
            <span style={{ ...sectionTitle, color: '#6b7280' }}>Anonymous</span>
            <span style={badge}>{anonymous.length} {anonymous.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          <FeedbackTable rows={anonymous} />
        </Box>
      )}
    </Box>
  )
}

const cell = { border: '1px solid #ddd', padding: '7px 12px', verticalAlign: 'top', color: '#111827' }

const sectionHeader = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
  paddingBottom: 8,
  borderBottom: '2px solid #e5e7eb',
}

const userIcon = { fontSize: 16 }

const sectionTitle = {
  fontSize: 15,
  fontWeight: 700,
  color: '#1f2937',
}

const badge = {
  fontSize: 12,
  background: '#f3f4f6',
  color: '#6b7280',
  borderRadius: 12,
  padding: '2px 10px',
  fontWeight: 500,
}
