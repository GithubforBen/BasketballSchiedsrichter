import { confirmationState, openConfirmations } from './confirmation';
import { qualifiedReferees } from './rules';
import { refereeSlots, substituteSlots } from './slots';
import { gameStatus } from './status';
import { describeLeadTime } from './time';
import type { ClubSettings, Game, Referee, Slot } from './types';

/**
 * Meldungen an die Admins. Regel 20.
 *
 * Jede Meldung traegt alles bei sich, was zum Handeln noetig ist: welches Spiel,
 * welche Liga, welcher Ort, was fehlt und wie viel Vorlauf bleibt. Der Admin
 * soll nicht erst nachschlagen muessen.
 */

export type AlertKind = 'unfilled' | 'confirmation-overdue' | 'substitute-missing';

export interface AdminAlertSettings {
  /** Sofort, wenn ein Spiel ohne zwei Schiedsrichter ist. */
  unfilled: boolean;
  /** Wenn eine Pflichtbestaetigung die Nachfassfrist reisst. */
  confirmationOverdue: boolean;
  /** Wenn Ersatzplaetze offen sind, obwohl beide Schiedsrichter stehen. */
  substituteMissing: boolean;
  /** Abendliche Zusammenfassung statt einer Meldung pro Vorgang. Regel 20. */
  dailyDigest: boolean;
}

export const DEFAULT_ALERT_SETTINGS: AdminAlertSettings = {
  unfilled: true,
  confirmationOverdue: true,
  substituteMissing: true,
  dailyDigest: true,
};

export interface AdminAlert {
  kind: AlertKind;
  gameId: string;
  /** Anzeigename der Meldungsart, wie im Mockup. */
  label: string;
  /** Was fehlt — in einem Satz. */
  detail: string;
  /** Zusatzinfo fuer die Einordnung: wie viele kommen in Frage, was ist moeglich. */
  meta: string;
  /** Dringlichkeit fuer die Sortierung: je kleiner, desto eiliger. */
  msUntilKickoff: number;
}

export interface AlertInput {
  game: Game;
  slots: readonly Slot[];
}

export const buildAdminAlerts = (
  games: readonly AlertInput[],
  referees: readonly Referee[],
  settings: ClubSettings,
  alertSettings: AdminAlertSettings,
  now: Date,
): readonly AdminAlert[] => {
  const alerts: AdminAlert[] = [];

  for (const { game, slots } of games) {
    if (game.state === 'cancelled' || game.kickoff.getTime() <= now.getTime()) continue;

    const msUntilKickoff = game.kickoff.getTime() - now.getTime();
    const lead = describeLeadTime(game.kickoff, now);
    const qualified = qualifiedReferees(referees, game.leagueId).length;
    const missingReferees = refereeSlots(slots).filter((s) => s.assignment === null).length;
    const missingSubstitutes = substituteSlots(slots).filter((s) => s.assignment === null).length;

    if (alertSettings.unfilled && missingReferees > 0) {
      alerts.push({
        kind: 'unfilled',
        gameId: game.id,
        label: gameStatus(slots).label,
        detail: `${missingReferees} von ${refereeSlots(slots).length} Schiedsrichter-Plaetzen offen, ${missingSubstitutes} Ersatzplaetze frei. Anpfiff ${lead}.`,
        meta: `${qualified} qualifizierte Schiedsrichter fuer ${game.leagueId}`,
        msUntilKickoff,
      });
    }

    if (alertSettings.confirmationOverdue) {
      const overdue = openConfirmations(slots, game, settings, now).filter(
        (s) => confirmationState(s, game, settings, now) === 'overdue',
      );
      if (overdue.length > 0) {
        alerts.push({
          kind: 'confirmation-overdue',
          gameId: game.id,
          label: 'Bestaetigung offen',
          detail: `${overdue.length} Pflichtbestaetigung(en) seit mehr als ${settings.confirmationFollowUpHours} Stunden unbeantwortet. Anpfiff ${lead}.`,
          meta: 'Nachfassen ist automatisch erfolgt · Meldung geht an alle Admins',
          msUntilKickoff,
        });
      }
    }

    if (alertSettings.substituteMissing && missingReferees === 0 && missingSubstitutes > 0) {
      alerts.push({
        kind: 'substitute-missing',
        gameId: game.id,
        label: 'Ersatz fehlt',
        detail: `${missingSubstitutes} Ersatzplatz frei. Beide Schiedsrichter sind besetzt. Anpfiff ${lead}.`,
        meta: `${qualified} qualifizierte Schiedsrichter fuer ${game.leagueId}`,
        msUntilKickoff,
      });
    }
  }

  return alerts.sort((a, b) => a.msUntilKickoff - b.msUntilKickoff);
};
