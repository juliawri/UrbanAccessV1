import { useState } from 'react'
import { Link } from 'react-router-dom'
import './SettingsPage.css'

const MOBILITY_AID_OPTIONS = [
  { label: 'No Mobility Aid',     value: 'no mobility aid' },
  { label: 'Manual Wheelchair',   value: 'manual wheelchair' },
  { label: 'Electric Wheelchair', value: 'electric wheelchair' },
  { label: 'Walker',              value: 'walker' },
  { label: 'Walking Cane',        value: 'walking cane' },
  { label: 'Mobility Scooter',    value: 'mobility scooter' },
]

export default function SettingsPage() {
  const [fastMode, setFastMode] = useState(
    () => localStorage.getItem('fast_mode') === 'true'
  )
  const [defaultMobilityAid, setDefaultMobilityAid] = useState(
    () => localStorage.getItem('default_mobility_aid') || 'manual wheelchair'
  )
  const [defaultZoom, setDefaultZoom] = useState(
    () => localStorage.getItem('default_zoom') || '13'
  )
  const [showStopNames, setShowStopNames] = useState(
    () => localStorage.getItem('show_stop_names') === 'true'
  )

  function handleFastModeChange(val) {
    setFastMode(val)
    localStorage.setItem('fast_mode', val)
  }

  function handleMobilityAidChange(e) {
    setDefaultMobilityAid(e.target.value)
    localStorage.setItem('default_mobility_aid', e.target.value)
  }

  function handleZoomChange(e) {
    setDefaultZoom(e.target.value)
    localStorage.setItem('default_zoom', e.target.value)
  }

  function handleShowStopNamesChange(val) {
    setShowStopNames(val)
    localStorage.setItem('show_stop_names', val)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f8fb' }}>
      {/* Navbar */}
      <nav className="settings-nav">
        <Link to="/" style={{ color: '#fff', fontSize: '16px', fontWeight: 500, textDecoration: 'underline' }}>
          ← Back to Map
        </Link>
        <Link to="/settings" style={{ color: '#d4e8f4', fontSize: '16px', fontWeight: 500, textDecoration: 'underline' }}>
          Settings
        </Link>
      </nav>

      {/* Page content */}
      <div className="settings-content">
        <h1 className="settings-title" style={{ fontFamily: "'Exo 2', sans-serif" }}>
          Settings
        </h1>
        <p style={{ color: '#5a7a7a', marginBottom: '40px', fontSize: '16px' }}>
          Customize your Urban Access experience.
        </p>

        {/* Performance */}
        <SettingsSection title="Performance">
          <SettingsRow
            label="Find Routes Faster"
            description="Skip street-level photo analysis. Routes are ranked using accessibility data only."
          >
            <Toggle checked={fastMode} onChange={handleFastModeChange} />
          </SettingsRow>
        </SettingsSection>

        {/* Accessibility */}
        <SettingsSection title="Accessibility">
          <SettingsRow label="Default Mobility Aid">
            <select style={selectStyle} value={defaultMobilityAid} onChange={handleMobilityAidChange}>
              {MOBILITY_AID_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </SettingsRow>
          <SettingsRow label="Prefer elevator routes">
            <Toggle />
          </SettingsRow>
          <SettingsRow label="Avoid steep slopes">
            <Toggle />
          </SettingsRow>
        </SettingsSection>

        {/* Map */}
        <SettingsSection title="Map">
          <SettingsRow label="Default zoom level">
            <select style={selectStyle} value={defaultZoom} onChange={handleZoomChange}>
              <option value="11">11 — City</option>
              <option value="13">13 — Neighbourhood</option>
              <option value="15">15 — Street</option>
            </select>
          </SettingsRow>
          <SettingsRow label="Show stop names on map">
            <Toggle checked={showStopNames} onChange={handleShowStopNamesChange} />
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  )
}

function SettingsSection({ title, children }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{
        fontSize: '13px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#d4722a',
        marginBottom: '12px',
      }}>
        {title}
      </h2>
      <div style={{
        background: '#fff',
        border: '1px solid #dce8ee',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

function SettingsRow({ label, description, children }) {
  return (
    <div className="settings-row">
      <div>
        <div style={{ fontSize: '14px', color: '#2c4a4a', fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: '12px', color: '#3a5a5a', marginTop: '2px' }}>{description}</div>
        )}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  const [internal, setInternal] = useState(false)
  const isOn = onChange !== undefined ? checked : internal

  function handleClick() {
    if (onChange) {
      onChange(!checked)
    } else {
      setInternal(v => !v)
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '40px',
        height: '22px',
        cursor: 'pointer',
        background: isOn ? '#1e3d3d' : '#ccc',
        borderRadius: '22px',
        border: 'none',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
      aria-checked={isOn}
      role="switch"
    >
      <span style={{
        position: 'absolute',
        height: '16px',
        width: '16px',
        left: isOn ? '20px' : '3px',
        top: '3px',
        background: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s',
        display: 'block',
      }} />
    </button>
  )
}

const selectStyle = {
  background: '#f4f8fb',
  border: '1px solid #ccd8e0',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '13px',
  color: '#2c4a4a',
  cursor: 'pointer',
}
