const BASE = '' // proxy handles routing in dev; same origin in prod

export async function searchStops(q) {
  const res = await fetch(`${BASE}/stops?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  return res.json()
}

export async function planRoute({ source, destination, disability_type, date, fast_mode }, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source, destination, disability_type, date, fast_mode: !!fast_mode }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() // { routes, result }
}


export async function getFeedback() {
  const token = import.meta.env.VITE_ADMIN_TOKEN
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(`${BASE}/api/feedback`, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function submitFeedback(payload, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() // { id }
}
