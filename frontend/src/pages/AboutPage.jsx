import ai4goodLogo from '../assets/ai4good.jpeg'
import milaLogo from '../assets/mila_logo.png'
import teamPhoto from '../assets/Team_Photo.JPG'
import Navbar from '../components/Navbar'
import { useT } from '../LanguageContext'
import './AboutPage.css'

export default function AboutPage() {
  const t = useT()

  return (
    <div className="about-page">
      <Navbar />

      <div className="about-hero">
        <img src={teamPhoto} alt="The Urban Access team" className="about-team-photo" />
        <div className="about-hero-bubble">
          <h1 className="about-title">Urban Access</h1>
          <p className="about-tagline">{t('about_tagline')}</p>
        </div>
      </div>

      <div className="about-content">

        <section className="about-section">
          <h2 className="about-section-label">{t('about_what_label')}</h2>
          <div className="about-card">
            <p>{t('about_what_p1')}</p>
            <p>{t('about_what_p2')}</p>
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-label">{t('about_how_label')}</h2>
          <div className="about-card about-steps">
            <div className="about-step">
              <span className="about-step-num">1</span>
              <div>
                <strong>{t('about_step1_title')}</strong>
                <p>{t('about_step1_desc')}</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-num">2</span>
              <div>
                <strong>{t('about_step2_title')}</strong>
                <p>{t('about_step2_desc')}</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-num">3</span>
              <div>
                <strong>{t('about_step3_title')}</strong>
                <p>{t('about_step3_desc')}</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-num">4</span>
              <div>
                <strong>{t('about_step4_title')}</strong>
                <p>{t('about_step4_desc')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-label">{t('about_feedback_label')}</h2>
          <div className="about-card">
            <p>{t('about_feedback_p')}</p>
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-label">{t('about_aids_label')}</h2>
          <div className="about-card about-aids">
            {t('about_aids').map(aid => (
              <span key={aid} className="about-aid-chip">{aid}</span>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-label">{t('about_partners_label')}</h2>
          <div className="about-partners">
            <a href="https://www.ai4goodlab.com" target="_blank" rel="noopener noreferrer" className="about-partner-card">
              <img src={ai4goodLogo} alt="AI4Good Lab" className="about-partner-img about-partner-img--square" />
              <span>AI4Good Lab</span>
            </a>
            <a href="https://mila.quebec" target="_blank" rel="noopener noreferrer" className="about-partner-card">
              <img src={milaLogo} alt="Mila" className="about-partner-img about-partner-img--wide" />
              <span>Mila – Québec AI Institute</span>
            </a>
          </div>
        </section>

      </div>
    </div>
  )
}
