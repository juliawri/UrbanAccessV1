import { useState } from 'react'
import { Button, Text, Stack } from '@chakra-ui/react'
import { supabase } from '../supabaseClient'
import { useT } from '../LanguageContext'

export default function AuthModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useT()

  if (!isOpen) return null

  function reset() {
    setError('')
    setMessage('')
    setEmail('')
    setPassword('')
  }

  function switchTab(newTab) {
    setTab(newTab)
    setError('')
    setMessage('')
  }

  async function handleSignIn() {
    if (!supabase) { setError(t('supabase_error')); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    reset()
    onClose()
  }

  async function handleSignUp() {
    if (!supabase) { setError(t('supabase_error')); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setMessage(t('account_created'))
  }

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        <h2 style={styles.title}>{t('your_account')}</h2>

        <div style={styles.tabs}>
          {['signin', 'signup'].map(tabKey => (
            <button
              key={tabKey}
              onClick={() => switchTab(tabKey)}
              style={{ ...styles.tab, ...(tab === tabKey ? styles.tabActive : {}) }}
            >
              {tabKey === 'signin' ? t('sign_in') : t('sign_up')}
            </button>
          ))}
        </div>

        <Stack gap={3}>
          <input
            type="email"
            placeholder={t('email_placeholder')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder={t('password_placeholder')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (tab === 'signin' ? handleSignIn() : handleSignUp())}
            style={styles.input}
          />

          {error && <Text color="#dc2626" fontSize="sm">{error}</Text>}
          {message && <Text color="#16a34a" fontSize="sm">{message}</Text>}

          <Button
            onClick={tab === 'signin' ? handleSignIn : handleSignUp}
            loading={loading}
            loadingText={tab === 'signin' ? t('signing_in') : t('creating_account')}
            style={{ background: '#1e3d3d', color: '#fff', borderRadius: 8 }}
          >
            {tab === 'signin' ? t('sign_in') : t('create_account')}
          </Button>
        </Stack>

        <p style={styles.switchHint}>
          {tab === 'signin' ? t('dont_have_account') : t('already_have_account')}
          <button style={styles.switchLink} onClick={() => switchTab(tab === 'signin' ? 'signup' : 'signin')}>
            {tab === 'signin' ? t('sign_up_link') : t('sign_in_link')}
          </button>
        </p>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: '32px',
    width: '100%',
    maxWidth: 400,
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#6b7280',
    lineHeight: 1,
  },
  title: {
    margin: '0 0 20px',
    fontSize: 20,
    fontWeight: 700,
    color: '#1f2937',
  },
  tabs: {
    display: 'flex',
    gap: 0,
    marginBottom: 20,
    borderBottom: '1px solid #e5e7eb',
  },
  tab: {
    flex: 1,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    paddingBottom: 10,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    color: '#6b7280',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: '#1e3d3d',
    color: '#1e3d3d',
    fontWeight: 700,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#111827',
  },
  switchHint: {
    marginTop: 16,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#1e3d3d',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: 13,
  },
}
