import { useState } from 'react'
import { Link } from 'react-router-dom'
import ControlPanel from './components/ControlPanel'
import MapView from './components/MapView'
import RouteMap from './components/RouteMap'
import RouteDirections from './components/RouteDirections'
import FeedbackForm from './components/FeedbackForm'
import { planRoute } from './api'
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

  async function handlePlan(payload) {
    setLoading(true)
    setError('')
    setRoutes([])
    setResult('')
    try {
      const data = await planRoute(payload)
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

  function handleMapClick({ lat, lng }) {
    if (inputMode !== 'map') return
    const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    if (mapClickStep === 'origin') {
      setOrigin({ lat, lng, label })
      setMapClickStep('destination')
    } else {
      setDestination({ lat, lng, label })
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
        <a href="#map">Map</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
        <Link to="/settings" style={{ color: '#fff', textDecoration: 'underline' }}>Settings</Link>
      </nav>

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
              mapHeight="125vh"
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
          <RouteDirections routes={routes} result={result} showResult={false} />
          <RouteMap routes={routes} origin={origin} destination={destination} />
          <RouteDirections routes={routes} result={result} showCards={false} />
          <div className="new-route-row">
            <button className="new-route-btn" onClick={handleNewRoute}>Plan New Route</button>
          </div>
        </section>
      )}

      {/* Feedback Section */}
      <section className="feedback-section" id="contact">
        <div className="feedback-left">
          {routes.length > 0 && lastPayload ? (
            <FeedbackForm payload={lastPayload} routes={routes} result={result} />
          ) : (
            <div className="feedback-placeholder">
              <p className="feedback-placeholder-title">How was this route?</p>
              <label className="feedback-label">Rating (1–5): <input type="number" min="1" max="5" disabled /></label>
              <label className="feedback-label">Comment <input type="text" disabled /></label>
              <button className="feedback-submit" disabled>Submit Feedback</button>
            </div>
          )}
        </div>
        <div className="feedback-right">
          <h2 className="section-heading">Rank your route based off how accessible it was</h2>
        </div>
      </section>

      {/* CTA */}
      <div className="cta-row">
        <a href="#map" className="cta-btn">Try It Out</a>
      </div>

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
