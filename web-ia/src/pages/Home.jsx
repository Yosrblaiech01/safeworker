import { useNavigate } from 'react-router-dom';
import { Droplets, HardHat, HeartPulse, PersonStanding, Radar, Radio, ShieldAlert, Thermometer, Wifi, Activity } from 'lucide-react';
import { FactorySilhouette } from '../components/auth/IndustrialBackdrop';

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="home-page">
      <div className="home-backdrop" />
      <FactorySilhouette className="home-factory" />
      <div className="hazard-stripe home-hazard" />

      <header className="home-header">
        <div className="home-brand">
          <div className="home-brand-icon">
            <HardHat size={26} />
          </div>
          <div>
            <h1>SAFE WORKER</h1>
            <p>INDUSTRIAL MONITOR</p>
          </div>
        </div>

        <div className="home-header-actions">
          <button type="button" className="home-button home-button-secondary" onClick={() => navigate('/login')}>
            Se connecter
          </button>
          <button type="button" className="home-button home-button-primary home-header-signup" onClick={() => navigate('/signup')}>
            Créer un compte
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-content">
          <div className="home-live-badge">
            <Radio size={16} />
            Surveillance des travailleurs en temps réel
          </div>

          <h2 className="home-title">
            Sécurité industrielle
            <span>pilotée par capteurs</span>
          </h2>

          <p className="home-description">
            Suivez le rythme cardiaque, la température et l'humidité de l'air, la détection d'obstacles et le mouvement de
            chaque travailleur grâce à des bracelets connectés ESP32 et une plateforme Supabase en temps réel.
          </p>

          <div className="home-features">
            <FeatureCard
              icon={<Activity size={22} />}
              title="Mesures en direct"
              text="Rythme cardiaque, température, humidité, obstacles et mouvement actualisés en continu."
            />
            <FeatureCard
              icon={<ShieldAlert size={22} />}
              title="Alertes de sécurité"
              text="Seuils réglables : surchauffe, effort cardiaque excessif, obstacle proche, mouvement anormal, travailleur immobile."
            />
            <FeatureCard
              icon={<Wifi size={22} />}
              title="Bracelets connectés"
              text="Architecture ESP32 → Supabase. Chaque bracelet est associé à un travailleur depuis l'interface."
            />
          </div>
        </div>

        <div className="home-live-card">
          <div className="home-live-card-header">
            <span>TÉLÉMÉTRIE TRAVAILLEUR</span>
            <span className="home-connected">
              <span />
              Connecté
            </span>
          </div>

          <div className="home-live-card-grid">
            <Metric icon={<HeartPulse size={13} color="#fb7185" />} label="Rythme cardiaque" value="86 bpm" />
            <Metric icon={<Thermometer size={13} color="#f59e0b" />} label="Température air" value="29.4 °C" />
            <Metric icon={<Droplets size={13} color="#38bdf8" />} label="Humidité air" value="48 %" />
            <Metric icon={<Radar size={13} color="#a78bfa" />} label="Obstacle" value="142 cm" />
            <Metric
              wide
              icon={<PersonStanding size={13} color="#34d399" />}
              label="Intensité de mouvement"
              value="24 / 100 · Normal"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <article className="home-feature-card">
      <div className="home-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Metric({ icon, label, value, wide }) {
  return (
    <div className={`home-metric ${wide ? 'home-metric-wide' : ''}`}>
      <p>
        {icon}
        {label}
      </p>
      <strong>{value}</strong>
    </div>
  );
}
