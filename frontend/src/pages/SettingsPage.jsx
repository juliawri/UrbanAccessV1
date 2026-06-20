import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { supabase } from '../supabaseClient'
import { deleteAccount } from '../api'
import { useT, useLanguage } from '../LanguageContext'
import './SettingsPage.css'

export default function SettingsPage() {
  const navigate = useNavigate()
  const t = useT()
  const { lang, toggleLanguage } = useLanguage()

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
  const [user, setUser] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const MOBILITY_AID_OPTIONS = [
    { label: t('aid_none'),     value: 'no mobility aid' },
    { label: t('aid_manual'),   value: 'manual wheelchair' },
    { label: t('aid_electric'), value: 'electric wheelchair' },
    { label: t('aid_walker'),   value: 'walker' },
    { label: t('aid_cane'),     value: 'walking cane' },
    { label: t('aid_scooter'),  value: 'mobility scooter' },
  ]

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      await deleteAccount(session.access_token)
      await supabase.auth.signOut()
      localStorage.clear()
      navigate('/')
    } catch (err) {
      setDeleteError(err.message || 'Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

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
    <div style={{ minHeight: '100vh', background: '#cce8f4' }}>
      <Navbar />

      <div className="settings-content">
        <h1 className="settings-title" style={{ fontFamily: "'Exo 2', sans-serif" }}>
          {t('settings_title')}
        </h1>
        <p style={{ color: '#2a2a2a', marginBottom: '40px', fontSize: '16px' }}>
          {t('settings_subtitle')}
        </p>

        <SettingsSection title={t('settings_language')}>
          <SettingsRow label={t('settings_language')}>
            <select style={selectStyle} value={lang} onChange={e => { if (e.target.value !== lang) toggleLanguage() }}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={t('settings_performance')}>
          <SettingsRow
            label={t('settings_faster_label')}
            description={t('settings_faster_desc')}
          >
            <Toggle checked={fastMode} onChange={handleFastModeChange} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={t('settings_accessibility')}>
          <SettingsRow label={t('settings_default_aid')}>
            <select style={selectStyle} value={defaultMobilityAid} onChange={handleMobilityAidChange}>
              {MOBILITY_AID_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </SettingsRow>
          <SettingsRow label={t('settings_prefer_elevator')}>
            <Toggle />
          </SettingsRow>
          <SettingsRow label={t('settings_avoid_steep')}>
            <Toggle />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={t('settings_map')}>
          <SettingsRow label={t('settings_default_zoom')}>
            <select style={selectStyle} value={defaultZoom} onChange={handleZoomChange}>
              <option value="11">{t('settings_zoom_city')}</option>
              <option value="13">{t('settings_zoom_neighbourhood')}</option>
              <option value="15">{t('settings_zoom_street')}</option>
            </select>
          </SettingsRow>
          <SettingsRow label={t('settings_show_stops')}>
            <Toggle checked={showStopNames} onChange={handleShowStopNamesChange} />
          </SettingsRow>
        </SettingsSection>

        {user && (
          <SettingsSection title={t('settings_account')}>
            <SettingsRow
              label={t('settings_delete_account')}
              description={t('settings_delete_desc')}
            >
              <button
                onClick={() => { setShowDeleteConfirm(true); setDeleteError(null) }}
                style={{
                  background: '#b91c1c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {t('settings_delete_account')}
              </button>
            </SettingsRow>
          </SettingsSection>
        )}
      </div>

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '380px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <h2 style={{ fontSize: '18px', color: '#1a1a1a', marginBottom: '12px' }}>
              {t('settings_delete_modal_title')}
            </h2>
            <p style={{ fontSize: '14px', color: '#444', marginBottom: '8px' }}>
              {t('settings_delete_modal_body')}
            </p>
            {deleteError && (
              <p style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '8px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  flex: 1, padding: '9px', borderRadius: '6px',
                  border: '1px solid #ccc', background: '#f4f4f4',
                  cursor: 'pointer', fontSize: '14px', color: '#333',
                }}
              >
                {t('settings_cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  flex: 1, padding: '9px', borderRadius: '6px',
                  border: 'none', background: '#b91c1c',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: '14px', color: '#fff', fontWeight: 600,
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? t('settings_deleting') : t('settings_yes_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
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
