import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Note } from '@/components/primitives';
import { DayNavigator } from '@/components/games/DayNavigator';
import { GameEntry } from '@/components/games/GameEntry';
import { RelocationBanner } from '@/components/games/RelocationBanner';
import { FOOTER_NAV, REFEREE_NAV, REFEREE_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { confirmationDueAt, confirmationState } from '@/domain/confirmation';
import { dateLabel, groupByMatchday, matchTitle, statusOf, timeLabel } from '@/domain/schedule';
import { isLicensedFor, isQualified } from '@/domain/rules';
import { slotOf } from '@/domain/slots';
import { slotViews, substituteRequestView } from '@/domain/slot-actions';
import { describeHoursDative, describeLeadTime } from '@/domain/time';
import type { Game } from '@/domain/types';
import { initialsById } from '@/server/queries/games';
import { loadReferee } from '@/server/queries/referees';
import { pendingRelocations, upcomingGamesWithSlots } from '@/server/queries/referee-view';
import { loadSettings } from '@/server/queries/settings';
import { requireUser } from '@/server/guard';
import { openGamesRoute } from '@/routes';

/**
 * Offene Spiele, nach Spieltagen getrennt.
 *
 * Ein Spieltag zur Zeit — gewechselt wird durch Wischen, mit den Pfeiltasten
 * oder ueber die beiden Knoepfe. Der gewaehlte Tag steht in der Adresse, damit
 * ein Zurueckspringen im Browser und ein geteilter Link funktionieren.
 */

export const metadata: Metadata = { title: `Offene Spiele · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const OpenGames = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireUser(now);
  const params = await searchParams;

  const [referee, settings, entries, initials, relocations] = await Promise.all([
    loadReferee(user.id),
    loadSettings(),
    upcomingGamesWithSlots(now),
    initialsById(),
    pendingRelocations(user.id, now),
  ]);
  if (!referee) throw new Error(`Konto ${user.id} nicht gefunden`);

  const matchdays = groupByMatchday(entries, CLUB.timeZone);
  const requested = single(params.tag);
  const index = Math.max(
    0,
    matchdays.findIndex((day) => day.key === requested),
  );
  const day = matchdays[index];

  const shell = (children: React.ReactNode) => (
    <Shell
      nav={REFEREE_NAV}
      tabs={REFEREE_TABS}
      footerNav={FOOTER_NAV}
      current="/spiele"
      user={{ name: user.name, initials: user.initials }}
    >
      {children}
    </Shell>
  );

  if (!day) {
    return shell(
      <>
        <div className="page-head">
          <div className="page-head-text">
            <h1>Offene Spiele</h1>
          </div>
        </div>
        <Note>Zurzeit sind keine kommenden Spiele eingetragen.</Note>
      </>,
    );
  }

  const previousDay = matchdays[index - 1]?.key ?? null;
  const nextDay = matchdays[index + 1]?.key ?? null;

  // Spiele desselben Kalendertags, in denen die Person schon steht — Regel 6.
  const myGamesThatDay = day.games
    .filter((entry) => slotOf(entry.slots, referee.id) !== null)
    .map((entry) => entry.game);

  const hint = single(params.hinweis);
  const error = single(params.fehler);

  return shell(
    <>
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Wer zuerst einträgt, hat den Platz</div>
          <h1>Offene Spiele</h1>
          <p className="text-muted">
            Nach Spieltagen getrennt. Wischen, Pfeiltasten oder die Knöpfe wechseln den Tag.
          </p>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
        {previousDay ? (
          <Link href={openGamesRoute(previousDay)} className="btn btn-secondary">
            ◀ Vortag
          </Link>
        ) : (
          <Button variant="secondary" disabled>
            ◀ Vortag
          </Button>
        )}
        {nextDay ? (
          <Link href={openGamesRoute(nextDay)} className="btn btn-secondary">
            Nächster Tag ▶
          </Link>
        ) : (
          <Button variant="secondary" disabled>
            Nächster Tag ▶
          </Button>
        )}
        <span className="text-muted" style={{ fontSize: '12px', marginLeft: 'auto' }}>
          Spieltag {index + 1} von {matchdays.length}
        </span>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? <p className="form-success">{hint}</p> : null}

      {relocations.map((entry) => (
        <RelocationBanner
          key={entry.game.id}
          gameId={entry.game.id}
          day={day.key}
          title={matchTitle(entry.game)}
          detail={`Neuer Termin: ${dateLabel(entry.game.kickoff, CLUB.timeZone)}, ${timeLabel(
            entry.game.kickoff,
            CLUB.timeZone,
          )} · ${entry.game.venue}. Anpfiff ${describeLeadTime(entry.game.kickoff, now)}.`}
          roleLabel={entry.role}
        />
      ))}

      <DayNavigator previousDay={previousDay} nextDay={nextDay}>
        <div className="matchday-head">
          <h2 className="matchday-title">{day.label}</h2>
          <span className="text-muted" style={{ fontSize: '13px' }}>
            {day.summary} · Anpfiff {describeLeadTime(day.firstKickoff, now)}
          </span>
        </div>

        {day.games.map((entry) => {
          /*
           * Sehen darf jeder jedes Spiel — eintragen nur, wer die Liga *und*
           * die Lizenz hat. Steht der Grund nicht am Spiel, sucht die Person
           * einen Knopf, den es fuer sie nicht gibt.
           */
          const qualified = isQualified(referee, entry.game.leagueId);
          const licensed = isLicensedFor(referee, entry.game);
          const context = {
            game: entry.game,
            slots: entry.slots,
            referee,
            sameDayAssignments: myGamesThatDay,
            settings,
            now,
            timeZone: CLUB.timeZone,
          };
          const own = slotOf(entry.slots, referee.id);
          const confirmation = own ? confirmationState(own, entry.game, settings, now) : null;

          return (
            <GameEntry
              key={entry.game.id}
              game={entry.game}
              day={day.key}
              timeZone={CLUB.timeZone}
              status={statusOf(entry)}
              slots={slotViews(context)}
              substituteRequest={substituteRequestView(context)}
              initials={initials}
              eligible={qualified && licensed}
              eligibilityNote={
                (qualified
                  ? `Qualifiziert für ${entry.game.leagueId}. `
                  : `Keine Qualifikation für ${entry.game.leagueId}. `) +
                (licensed
                  ? ''
                  : referee.license === null
                    ? 'Für dich ist keine Lizenz hinterlegt — ohne sie ist keine Eintragung möglich. '
                    : `Dieses Spiel verlangt Lizenz ${entry.game.requiredLicense}, du hast ${referee.license}. `) +
                'Plätze werden der Reihe nach vergeben: Schiri 1 → Schiri 2 → Ersatz 1 → Ersatz 2.'
              }
              leadNote={`Anpfiff ${describeLeadTime(entry.game.kickoff, now)}`}
              confirmation={confirmation}
              confirmationHint={confirmationHint(entry.game, settings, now)}
            />
          );
        })}
      </DayNavigator>
    </>,
  );
};

const confirmationHint = (
  game: Game,
  settings: Awaited<ReturnType<typeof loadSettings>>,
  now: Date,
): string => {
  const due = confirmationDueAt(game, settings);
  return due > now
    ? `Die Nachfrage kommt ${describeHoursDative(settings.confirmationLeadHours)} vor Anpfiff.`
    : `Angefordert ${describeHoursDative(settings.confirmationLeadHours)} vor Anpfiff. Ohne Antwort innerhalb von ${describeHoursDative(settings.confirmationFollowUpHours)} geht eine erneute Erinnerung an dich und eine Meldung an die Admins.`;
};

export default OpenGames;
