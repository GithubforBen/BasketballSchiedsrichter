import type { Metadata } from 'next';
import Link from 'next/link';
import { Note } from '@/components/primitives';
import { PublicMatchday } from '@/components/schedule/PublicMatchday';
import { FOOTER_NAV, navForViewer } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { scheduleRoute } from '@/routes';
import {
  initialsById,
  namesById,
  pastMatchdays,
  upcomingMatchdays,
} from '@/server/queries/games';
import { currentUser } from '@/server/viewer';

/**
 * Der Spielplan — oeffentlich, oder als Spieluebersicht der Schiedsrichter.
 *
 * **Ohne Anmeldung** ist das die oeffentliche Spieltagsansicht: bewusst ohne
 * personenbezogene Daten ausser dem Kuerzel (Regel 29). Serverseitig
 * gerendert: die Seite ist die Visitenkarte des Vereins und soll ohne Umweg
 * da sein.
 *
 * **Ein angemeldeter Schiedsrichter** sieht an derselben Stelle die
 * Spieluebersicht: dieselben Spiele, aber mit vollen Namen, und auf Wunsch
 * mit den vergangenen Spieltagen. Der Name ist innerhalb der Abteilung keine
 * vertrauliche Angabe — das Ziel ist, dass niemand die Kuerzel aller anderen
 * kennen muss. Verwaltet wird hier nichts; eintragen geht unter "Offene
 * Spiele", abgeben unter "Kalender & Verlauf".
 *
 * **Ein Admin** sieht weiterhin die oeffentliche Ansicht, mit Kuerzeln. Er hat
 * seine eigene Spieluebersicht mit Namen und Bearbeiten-Knopf; hier soll er
 * sehen koennen, was die Oeffentlichkeit sieht.
 */

/*
 * Der Titel folgt der Seite: angemeldete Schiedsrichter sehen die
 * Spieluebersicht, und der Reiter soll nicht "Spielplan" sagen, waehrend die
 * Ueberschrift "Spielübersicht" sagt.
 */
export const generateMetadata = async (): Promise<Metadata> =>
  (await currentUser())?.role === 'referee'
    ? { title: `Spielübersicht · ${CLUB.appName}` }
    : {
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

/**
 * Obergrenze fuer `?spieltage=`.
 *
 * Die Zahl steht in der Adresse und kommt damit von aussen. `Math.max` allein
 * begrenzte sie nur nach unten: `?spieltage=999999999` war erlaubt und
 * uebersprang das schrittweise Nachladen, um dessentwillen die Seite ueberhaupt
 * gestueckelt ist. Wirklich gefaehrlich ist das nicht — mehr als alle
 * vorhandenen Spieltage kann auch diese Zahl nicht herbeischaffen —, aber eine
 * Zahl aus dem Netz, die ungeprueft in eine Abfragegrenze wandert, soll hier
 * nicht stehen. Sechzig Spieltage sind mehr als eine ganze Saison; wer sich
 * ueber "Weitere Spieltage" durchklickt, stoesst nie daran.
 */
const MAX_MATCHDAYS = 60;

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
  const shown = Number.isFinite(requested)
    ? Math.min(MAX_MATCHDAYS, Math.max(PAGE_SIZE, requested))
    : PAGE_SIZE;

  const user = await currentUser(now);
  const asReferee = user?.role === 'referee';
  /* Die Vergangenheit gibt es nur in der Spieluebersicht der Angemeldeten. */
  const withPast = asReferee && single(params.vergangene) === 'an';

  const [{ matchdays, total }, labels, past] = await Promise.all([
    upcomingMatchdays(now, shown),
    /*
     * Hier faellt die Entscheidung, ob Namen die Seite verlassen — an einer
     * Stelle und nirgends sonst. Die Komponente darunter zeigt, was sie
     * bekommt.
     */
    asReferee ? namesById() : initialsById(),
    withPast ? pastMatchdays(now) : Promise.resolve([]),
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
          {asReferee ? (
            <>
              <div className="kicker kicker-accent">Alle Spiele</div>
              <h1>Spielübersicht</h1>
              <p className="lead text-muted">
                Alle kommenden Spiele mit ihrer Besetzung, mit vollen Namen. Eintragen kannst du
                dich unter „Offene Spiele“; deine eigenen Spiele gibst du unter „Kalender &amp;
                Verlauf“ ab.
              </p>
            </>
          ) : (
            <>
              <div className="kicker kicker-accent">Öffentlich</div>
              <h1>Spielplan</h1>
              <p className="lead text-muted">
                Zwei gleichwertige Schiedsrichter pro Spiel, zwei Ersatzplätze. Ohne Anmeldung
                erscheinen Schiedsrichter nur als Kürzel — kein Name, keine Telefonnummer.
                {user ? (
                  <> So sieht der Spielplan ohne Anmeldung aus.</>
                ) : (
                  <> Angemeldet siehst du die vollen Namen.</>
                )}
              </p>
            </>
          )}
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

      {asReferee ? (
        <>
          {/*
            Ein Verweis und kein aufklappbarer Block: die vergangenen Spiele
            werden erst geladen, wenn jemand sie sehen will. Eine ganze Saison
            im Voraus mitzuschicken, nur damit sie zugeklappt im Telefon liegt,
            waere genau das Gewicht, das der Spielplan mit seinen Spieltagen in
            Portionen vermeidet.
          */}
          <div className="row" style={{ marginTop: 'var(--space-4)' }}>
            <Link
              href={scheduleRoute({
                ...(Number.isFinite(requested) ? { spieltage: shown } : {}),
                vergangene: !withPast,
              })}
              className={`btn ${withPast ? 'btn-secondary' : 'btn-ghost'}`}
              scroll={false}
              aria-expanded={withPast}
            >
              {withPast ? 'Vergangene Spiele ausblenden' : 'Vergangene Spiele anzeigen'}
            </Link>
          </div>

          {withPast ? (
            <section aria-labelledby="vergangene-spiele">
              <h2 id="vergangene-spiele" className="kicker" style={{ marginTop: 'var(--space-6)' }}>
                Vergangene Spiele · neueste zuerst
              </h2>
              {past.length === 0 ? (
                <Note>Noch keine vergangenen Spiele.</Note>
              ) : (
                past.map((matchday) => (
                  <PublicMatchday
                    key={matchday.key}
                    matchday={matchday}
                    timeZone={CLUB.timeZone}
                    labels={labels}
                    display="names"
                  />
                ))
              )}
              <h2 className="kicker" style={{ marginTop: 'var(--space-8)' }}>
                Kommende Spiele
              </h2>
            </section>
          ) : null}
        </>
      ) : null}

      {matchdays.length === 0 ? (
        <Note>Zurzeit sind keine kommenden Spiele eingetragen.</Note>
      ) : (
        <>
          {matchdays.map((matchday) => (
            <PublicMatchday
              key={matchday.key}
              matchday={matchday}
              timeZone={CLUB.timeZone}
              labels={labels}
              display={asReferee ? 'names' : 'initials'}
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
                href={scheduleRoute({ spieltage: shown + PAGE_SIZE, vergangene: withPast })}
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
