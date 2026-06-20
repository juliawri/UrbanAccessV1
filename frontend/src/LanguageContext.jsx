import { createContext, useContext, useState } from 'react'
import { translations } from './translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'en')

  function toggleLanguage() {
    const next = lang === 'en' ? 'fr' : 'en'
    setLang(next)
    localStorage.setItem('language', next)
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function useT() {
  const { lang } = useLanguage()
  return (key) => translations[lang]?.[key] ?? translations.en[key] ?? key
}
