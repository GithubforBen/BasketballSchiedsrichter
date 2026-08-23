import { Shell, type NavTarget } from '@/components/shell/Shell';

/**
 * Platzhalter-Startseite fuer M0/M1.
 *
 * Die oeffentliche Spieltagsansicht entsteht in M2; hier steht bislang nur das
 * Grundraster, damit Seitenleiste und Tab-Leiste ueberprueft werden koennen.
 */

const NAV: readonly NavTarget[] = [
  { href: '/', label: 'Öffentliche Ansicht', short: 'Spiele' },
];

const Home = () => (
  <Shell nav={NAV} current="/">
    <div className="page-head">
      <div className="page-head-text">
        <div className="kicker kicker-accent">Meilenstein 0 und 1</div>
        <h1>Schiedsrichter-Planung</h1>
        <p className="text-muted">
          Fundament, Datenmodell und Regelwerk stehen. Die öffentliche Spieltagsansicht folgt in
          Meilenstein 2.
        </p>
      </div>
    </div>
  </Shell>
);

export default Home;
