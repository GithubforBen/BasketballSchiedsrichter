import type { Metadata } from 'next';
import { Note } from '@/components/primitives';
import { PublicMatchday } from '@/components/schedule/PublicMatchday';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { initialsById, upcomingMatchdays } from '@/server/queries/games';
import { currentUser } from '@/server/viewer';

/**
 * Die oeffentliche Spieltagsansicht.
 *
 * Ohne Login sichtbar und bewusst ohne personenbezogene Daten ausser dem
 * Kuerzel (Regel 29). Serverseitig gerendert: die Seite ist die Visitenkarte
 * des Vereins und soll ohne Umweg da sein.
 */

export const metadata: Metadata = {
  title: `Spielplan · ${CLUB.name}`,
  description: 'Kommende Spiele und ihre Schiedsrichter-Besetzung.',
};

export const dynamic = 'force-dynamic';

const PublicSchedule = async () => {
  const now = new Date();
  const [matchdays, initials, user] = await Promise.all([
    upcomingMatchdays(now),
    initialsById(),
    currentUser(now),
  ]);

  return (
    <Shell
      nav={PUBLIC_NAV}
      tabs={PUBLIC_TABS}
      footerNav={FOOTER_NAV}
      current="/"
      user={user ? { name: user.name, initials: user.initials } : undefined}
    >
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Öffentlich</div>
          <h1>Spielplan</h1>
          <p className="text-muted">
            Zwei gleichwertige Schiedsrichter pro Spiel, zwei Ersatzplätze. Ohne Anmeldung
            erscheinen Schiedsrichter nur als Kürzel — kein Name, kein Profilbild.
          </p>
        </div>
        <ul className="legend">
          <li>
            <span className="status-dot" style={{ background: 'var(--status-filled)' }} />
            besetzt
          </li>
          <li>
            <span
              className="status-dot"
              style={{ background: 'var(--status-substitute-missing)' }}
            />
            Ersatz fehlt
          </li>
          <li>
            <span className="status-dot" style={{ background: 'var(--status-open)' }} />
            offen
          </li>
        </ul>
      </div>

      {matchdays.length === 0 ? (
        <Note>Zurzeit sind keine kommenden Spiele eingetragen.</Note>
      ) : (
        matchdays.map((matchday) => (
          <PublicMatchday
            key={matchday.key}
            matchday={matchday}
            timeZone={CLUB.timeZone}
            initials={initials}
          />
        ))
      )}
    </Shell>
  );
};

export default PublicSchedule;
