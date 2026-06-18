import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function SettingsPage() {
  const [fastMode, setFastMode] = useState(
    () => localStorage.getItem('fast_mode') === 'true'
  )

  function handleFastModeChange(val) {
    setFastMode(val)
    localStorage.setItem('fast_mode', val)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f8fb' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: '#1e3d3d',
        display: 'flex', gap: '48px',
        padding: '16px 40px',
      }}>
        <Link to="/" style={{ color: '#fff', fontSize: '16px', fontWeight: 500, textDecoration: 'underline' }}>
          ← Back to Map
        </Link>
        <Link to="/settings" style={{ color: '#d4e8f4', fontSize: '16px', fontWeight: 500, textDecoration: 'underline' }}>
          Settings
        </Link>
      </nav>

      {/* Page content */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{
          fontFamily: "'Exo 2', sans-serif",
          fontSize: '48px',
          color: '#1e3d3d',
          fontWeight: 600,
          marginBottom: '8px',
        }}>
          Settings
        </h1>
        <p style={{ color: '#5a7a7a', marginBottom: '40px', fontSize: '16px' }}>
          Customize your Urban Access experience.
        </p>

        {/* Performance */}
        <SettingsSection title="Performance">
          <SettingsRow
            label="Find Routes Faster"
            description="Skips street-level photo analysis (Mapillary, MAE, Gemini). Routes are ranked using accessibility data only."
          >
            <Toggle checked={fastMode} onChange={handleFastModeChange} />
          </SettingsRow>
        </SettingsSection>

        {/* Accessibility */}
        <SettingsSection title="Accessibility">
          <SettingsRow label="Default Mobility Aid">
            <select style={selectStyle}>
              <option>No Mobility Aid</option>
              <option>Manual Wheelchair</option>
              <option>Electric Wheelchair</option>
              <option>Walker</option>
              <option>Walking Cane</option>
              <option>Mobility Scooter</option>
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
            <select style={selectStyle}>
              <option value="11">11 — City</option>
              <option value="13">13 — Neighbourhood</option>
              <option value="15">15 — Street</option>
            </select>
          </SettingsRow>
          <SettingsRow label="Show stop names on map">
            <Toggle />
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
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 20px',
      borderBottom: '1px solid #eef3f6',
      gap: '16px',
    }}>
      <div>
        <div style={{ fontSize: '14px', color: '#2c4a4a', fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: '12px', color: '#7a9a9a', marginTop: '2px' }}>{description}</div>
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
