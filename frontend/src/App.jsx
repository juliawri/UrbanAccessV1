import { useState, useEffect } from 'react'
import ControlPanel from './components/ControlPanel'
import MapView from './components/MapView'
import RouteMap from './components/RouteMap'
import RouteDirections from './components/RouteDirections'
import FeedbackForm from './components/FeedbackForm'
import Navbar from './components/Navbar'
import { planRoute } from './api'
import { supabase } from './supabaseClient'
import { useT, useLanguage } from './LanguageContext'
import urbanAccessLogo from './assets/UrbanAccessLogo.png'
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
  const t = useT()
  const { lang } = useLanguage()

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
      const data = await planRoute({ ...payload, language: lang }, token)
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
      <Navbar onMapClick={result ? handleNewRoute : undefined} />

      <section className="hero">
        <img src={urbanAccessLogo} alt="Urban Access logo" className="brand-logo" />
        <h1 className="brand-title">URBAN ACCESS</h1>
        <p className="brand-subtitle">{t('brand_subtitle')}</p>
        {!result && <div className="map-prompt-bubble">{t('map_prompt')}</div>}
      </section>

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

      {result && (
        <section className="results-section">
          <RouteDirections routes={routes} result={result} />
          <RouteMap routes={routes} origin={origin} destination={destination} />
        </section>
      )}

      {routes.length > 0 && lastPayload && (
        <section className="feedback-section" id="contact">
          <h2 className="section-heading feedback-heading">{t('feedback_heading')}</h2>
          <FeedbackForm payload={lastPayload} routes={routes} result={result} user={user} />
          <button className="new-route-btn new-route-btn--lg" onClick={handleNewRoute}>{t('plan_new_route')}</button>
        </section>
      )}

      <div className="bottom-bar">
        <div className="bottom-left">
          <span className="namedly-logo" style={{display: 'flex', alignItems: 'center', gap: '6px'}}><img src={urbanAccessLogo} alt="" style={{height: '22px'}} />Urban Access</span>
          <a href="/about">{t('learn_more')}</a>
        </div>
      </div>
    </div>
  )
}
