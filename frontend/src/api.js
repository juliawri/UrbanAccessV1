const BASE = '' // proxy handles routing in dev; same origin in prod

export async function searchStops(q) {
  const res = await fetch(`${BASE}/stops?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  return res.json()
}

export async function planRoute({ source, destination, disability_type, date }) {
  const res = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, destination, disability_type, date }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() // { routes, result }
}


export async function submitFeedback(payload) {
  const res = await fetch(`${BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() // { id }
}
