import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AuthModal from './AuthModal'
import { supabase } from '../supabaseClient'
import { useT } from '../LanguageContext'
import './Navbar.css'

export default function Navbar({ onMapClick }) {
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useT()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <nav className={`navbar${menuOpen ? ' navbar--open' : ''}`}>
        <div className="navbar-links">
          <Link to="/" onClick={onMapClick}>{t('nav_map')}</Link>
          <Link to="/about">{t('nav_about')}</Link>
          <Link to="/settings">{t('nav_settings')}</Link>
        </div>
        <div className="navbar-auth">
          {user ? (
            <>
              <span className="navbar-user">{user.email}</span>
              <button className="navbar-auth-btn" onClick={() => supabase.auth.signOut()}>{t('nav_signout')}</button>
            </>
          ) : (
            <button className="navbar-auth-btn" onClick={() => setShowAuth(true)}>{t('nav_signin')}</button>
          )}
        </div>

        <button
          className="navbar-hamburger"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>

        {menuOpen && (
          <div className="navbar-mobile-menu">
            <Link to="/" onClick={() => { onMapClick?.(); closeMenu() }}>{t('nav_map')}</Link>
            <Link to="/about" onClick={closeMenu}>{t('nav_about')}</Link>
            <Link to="/settings" onClick={closeMenu}>{t('nav_settings')}</Link>
            <div className="navbar-mobile-auth">
              {user ? (
                <>
                  <span className="navbar-mobile-user">{user.email}</span>
                  <button className="navbar-auth-btn" onClick={() => { supabase.auth.signOut(); closeMenu() }}>{t('nav_signout')}</button>
                </>
              ) : (
                <button className="navbar-auth-btn" onClick={() => { setShowAuth(true); closeMenu() }}>{t('nav_signin')}</button>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  )
}
