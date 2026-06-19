import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ControlPanel from './components/ControlPanel'
import MapView from './components/MapView'
import RouteMap from './components/RouteMap'
import RouteDirections from './components/RouteDirections'
import FeedbackForm from './components/FeedbackForm'
import AuthModal from './components/AuthModal'
import { planRoute } from './api'
import { supabase } from './supabaseClient'
import urbanAccessLogo from './assets/UrbanAccessLogo.png'
import ai4goodLogo from './assets/ai4good.jpeg'
import milaLogo from './assets/mila_logo.png'
import './App.css'

export default function App() {
  const [routes, setRoutes] = useState([])
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastPayload, setLastPayload] = useState(null)
  const [error, setError] = useState('')
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [inputMode, setInputMode] = useState('search')
  const [mapClickStep, setMapClickStep] = useState('origin')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handlePlan(payload) {
    setLoading(true)
    setError('')
    setRoutes([])
    setResult('')
    try {
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} }
      const token = session?.access_token ?? null
      const data = await planRoute(payload, token)
      setRoutes(data.routes)
      setResult(data.result)
      setLastPayload(payload)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleNewRoute() {
    setRoutes([])
    setResult('')
    setError('')
    setLastPayload(null)
    setOrigin(null)
    setDestination(null)
    setMapClickStep('origin')
  }

  async function handleMapClick({ lat, lng }) {
    if (inputMode !== 'map') return
    const fallbackLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    let label = fallbackLabel
    try {
      const res = await fetch(
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`
      )
      const data = await res.json()
      const props = data.features?.[0]?.properties
      if (props) {
        const streetPart = [props.housenumber, props.street].filter(Boolean).join(' ')
        const parts = [props.name, streetPart, props.city, props.country].filter(Boolean)
        if (parts.length) label = parts.join(', ')
      }
    } catch {
      // keep fallback label
    }
    if (mapClickStep === 'origin') {
      setOrigin({ lat, lng, label })
      setMapClickStep('destination')
    } else {
      setDestination({ lat, lng, label })
      setMapClickStep('origin')
    }
  }

  function handleInputModeChange(m) {
    setInputMode(m)
    setMapClickStep('origin')
    setOrigin(null)
    setDestination(null)
  }

  return (
    <div className="page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-links">
          <a href="#map">Map</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <Link to="/settings" style={{ color: '#fff', textDecoration: 'underline' }}>Settings</Link>
        </div>
        <div className="navbar-auth">
          {user ? (
            <>
              <span className="navbar-user">{user.email}</span>
              <button className="navbar-auth-btn" onClick={() => supabase.auth.signOut()}>Sign Out</button>
            </>
          ) : (
            <button className="navbar-auth-btn" onClick={() => setShowAuth(true)}>Sign In</button>
          )}
        </div>
      </nav>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />

      {/* Hero */}
      <section className="hero">
        <img src={urbanAccessLogo} alt="Urban Access logo" className="brand-logo" />
        <h1 className="brand-title">URBAN ACCESS</h1>
        <p className="brand-subtitle">Find the best route for your needs</p>
      </section>

      {/* Full-page Map — hidden once routes are returned */}
      {!result && (
        <section className="map-section" id="map">
          <div className="map-inner">
            <MapView
              routes={routes}
              onMapClick={handleMapClick}
              inputMode={inputMode}
              origin={origin}
              destination={destination}
              mapHeight={isMobile ? '60vh' : '125vh'}
              borderRadius="16px"
            />
            <div className="map-panel">
              <ControlPanel
                onPlan={handlePlan}
                loading={loading}
                origin={origin}
                destination={destination}
                onOriginChange={setOrigin}
                onDestinationChange={setDestination}
                inputMode={inputMode}
                onInputModeChange={handleInputModeChange}
                mapClickStep={mapClickStep}
                onResetMapClick={() => { setOrigin(null); setDestination(null); setMapClickStep('origin') }}
              />
              {error && <div className="error-box">{error}</div>}
            </div>
          </div>
        </section>
      )}

      {/* Route Results — replaces the map */}
      {result && (
        <section className="results-section">
          <RouteDirections routes={routes} result={result} />
          <RouteMap routes={routes} origin={origin} destination={destination} />
        </section>
      )}

      {/* Feedback Section — only shown after routes are generated */}
      {routes.length > 0 && lastPayload && (
        <section className="feedback-section" id="contact">
          <h2 className="section-heading feedback-heading">Rank Your Route Based On How Accessible It Was</h2>
          <FeedbackForm payload={lastPayload} routes={routes} result={result} user={user} />
          <button className="new-route-btn new-route-btn--lg" onClick={handleNewRoute}>Plan New Route</button>
        </section>
      )}

      {/* Partners */}
      <section className="partners">
        <img src={ai4goodLogo} alt="AI4Good Lab" className="partner-img partner-img--square" />
        <img src={milaLogo} alt="Mila" className="partner-img partner-img--wide" />
      </section>

      {/* Footer columns */}
      <section className="footer-cols" id="about">
        <div>
          <h4>Here text</h4>
          <p>Writing for websites is both simple and complex. On the one hand, all you need to do is say what you mean and in your words.</p>
        </div>
        <div>
          <h4>There text</h4>
          <p>Are you thinking of keywords you should rank for? Are you including links in your text to additional information?</p>
        </div>
        <div>
          <h4>Everywhere text</h4>
          <p>There's a theory that people read in an F-shape pattern, and that this should influence how you structure content on your website.</p>
        </div>
      </section>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <div className="bottom-left">
          <span className="namedly-logo">✦ Namedly</span>
          <a href="#">Features</a>
          <a href="#">Learn more</a>
          <a href="#">Support</a>
        </div>
        <div className="bottom-right">
          <a href="#" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          </a>
          <a href="#" aria-label="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
          <a href="#" aria-label="X (Twitter)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </div>
      </div>
    </div>
  )
}
