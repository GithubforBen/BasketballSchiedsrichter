import { describe, expect, it } from 'vitest';
import { inDays, inHours, makeGame, makeReferee, NOW, settings, slotsFrom } from './__fixtures__/build';
import { buildAdminAlerts, DEFAULT_ALERT_SETTINGS, type AlertInput } from './alerts';

const referees = [
  makeReferee({ id: 'r-jk', qualifications: ['U14'] }),
  makeReferee({ id: 'r-lb', name: 'Lena Brandt', qualifications: ['U14'] }),
  makeReferee({ id: 'r-tf', name: 'Timo Faerber', qualifications: ['U16'] }),
];

const build = (games: readonly AlertInput[], alertSettings = DEFAULT_ALERT_SETTINGS) =>
  buildAdminAlerts(games, referees, settings(), alertSettings, NOW);

describe('Regel 20 — Meldungen an die Admins', () => {
  it('meldet ein Spiel ohne zwei Schiedsrichter', () => {
    const alerts = build([{ game: makeGame(), slots: slotsFrom([null, null, null, null]) }]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe('unfilled');
  });

  it('traegt alles bei sich, was zum Handeln noetig ist', () => {
    const alerts = build([
      { game: makeGame({ kickoff: inDays(5) }), slots: slotsFrom(['r-lb', null, null, null]) },
    ]);
    const alert = alerts[0];
    expect(alert?.detail).toContain('1 von 2 Schiedsrichter-Plaetzen offen');
    expect(alert?.detail).toContain('in 5 Tagen');
    // Nur die beiden U14-Qualifizierten, nicht der U16-Schiedsrichter.
    expect(alert?.meta).toContain('2 qualifizierte');
  });

  it('meldet fehlenden Ersatz nur, wenn beide Schiedsrichter stehen', () => {
    const alerts = build([
      { game: makeGame(), slots: slotsFrom(['r-jk', 'r-lb', null, null]) },
    ]);
    expect(alerts.map((a) => a.kind)).toEqual(['substitute-missing']);
  });

  it('meldet eine ueberfaellige Pflichtbestaetigung', () => {
    // Vorlauf 72 h, Nachfassfrist 24 h: bei 40 h Restzeit ist die Anforderung
    // 32 h her und damit ueberfaellig.
    const game = makeGame({ kickoff: inHours(40) });
    const alerts = build([{ game, slots: slotsFrom(['r-jk', 'r-lb', 'r-tf', 'r-ay']) }]);
    expect(alerts.map((a) => a.kind)).toContain('confirmation-overdue');
  });

  it('laesst jede Meldungsart einzeln abschalten', () => {
    const games: AlertInput[] = [{ game: makeGame(), slots: slotsFrom([null, null, null, null]) }];
    expect(build(games, { ...DEFAULT_ALERT_SETTINGS, unfilled: false })).toHaveLength(0);
  });

  it('meldet weder abgesagte noch bereits angepfiffene Spiele', () => {
    const alerts = build([
      { game: makeGame({ state: 'cancelled' }), slots: slotsFrom([null, null, null, null]) },
      { game: makeGame({ id: 'g2', kickoff: inHours(-1) }), slots: slotsFrom([null, null, null, null]) },
    ]);
    expect(alerts).toHaveLength(0);
  });

  it('sortiert das Dringendste nach oben', () => {
    const alerts = build([
      { game: makeGame({ id: 'spaet', kickoff: inDays(20) }), slots: slotsFrom([null, null, null, null]) },
      { game: makeGame({ id: 'bald', kickoff: inDays(2) }), slots: slotsFrom([null, null, null, null]) },
    ]);
    expect(alerts.map((a) => a.gameId)).toEqual(['bald', 'spaet']);
  });
});
