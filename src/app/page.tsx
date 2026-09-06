import type { Metadata } from 'next';
import Link from 'next/link';
import { Note } from '@/components/primitives';
import { PublicMatchday } from '@/components/schedule/PublicMatchday';
import { FOOTER_NAV, navForViewer } from '@/components/shell/navigation';
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

/**
 * Wie viele Spieltage auf einmal kommen.
 *
 * Vorher stand hier der ganze Spielplan: vierundfuenfzig Spiele an
 * dreiundzwanzig Tagen wurden zu 320 kB, die ein Handy erst laden und dann
 * darstellen muss. Vier Spieltage sind ungefaehr die naechsten zwei Wochen —
 * das, wonach jemand schaut, der wissen will, wann er dran ist.
 */
const PAGE_SIZE = 4;

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PublicSchedule = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const params = await searchParams;

  /*
   * Die Anzahl steht in der Adresse und nicht in einem Zustand im Browser: so
   * ueberlebt sie das Neuladen, laesst sich verlinken und der Zurueck-Knopf
   * tut, was er soll.
   */
  const requested = Number.parseInt(single(params.spieltage) ?? '', 10);
  const shown = Number.isFinite(requested) ? Math.max(PAGE_SIZE, requested) : PAGE_SIZE;

  const [{ matchdays, total }, initials, user] = await Promise.all([
    upcomingMatchdays(now, shown),
    initialsById(),
    currentUser(now),
  ]);
  const remaining = total - matchdays.length;

  const { nav, tabs } = navForViewer(user);

  return (
    <Shell
      nav={nav}
      tabs={tabs}
      footerNav={FOOTER_NAV}
      current="/"
      user={user ? { name: user.name, initials: user.initials } : undefined}
    >
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Öffentlich</div>
          <h1>Spielplan</h1>
          <p className="lead text-muted">
            Zwei gleichwertige Schiedsrichter pro Spiel, zwei Ersatzplätze. Ohne Anmeldung
            erscheinen Schiedsrichter nur als Kürzel — kein Name, keine Telefonnummer.
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
        <>
          {matchdays.map((matchday) => (
            <PublicMatchday
              key={matchday.key}
              matchday={matchday}
              timeZone={CLUB.timeZone}
              initials={initials}
            />
          ))}

          {/*
            Nachladen als Link, nicht als Knopf mit Javascript: Next holt beim
            Klick nur den neuen Teil nach, und ohne Javascript bleibt es ein
            gewoehnlicher Verweis, der ebenfalls funktioniert.
          */}
          {remaining > 0 ? (
            <div className="load-more">
              <Link
                href={`/?spieltage=${shown + PAGE_SIZE}`}
                className="btn btn-secondary"
                scroll={false}
              >
                Weitere Spieltage
              </Link>
              <span className="text-muted">
                {matchdays.length} von {total} Spieltagen · noch {remaining}{' '}
                {remaining === 1 ? 'Spieltag' : 'Spieltage'}
              </span>
            </div>
          ) : (
            <p className="text-muted load-more-end">
              Das ist der ganze Spielplan — {total} {total === 1 ? 'Spieltag' : 'Spieltage'}.
            </p>
          )}
        </>
      )}
    </Shell>
  );
};

export default PublicSchedule;
