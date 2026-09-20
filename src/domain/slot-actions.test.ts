import { describe, expect, it } from 'vitest';
import {
  inDays,
  makeGame,
  makeReferee,
  NOW,
  settings,
  slotsFrom,
  TIME_ZONE,
} from './__fixtures__/build';
import { slotViews, substituteRequestView, type SlotViewContext } from './slot-actions';

const context = (overrides: Partial<SlotViewContext> = {}): SlotViewContext => ({
  game: makeGame(),
  slots: slotsFrom([null, null, null, null]),
  referee: makeReferee(),
  sameDayAssignments: [],
  settings: settings(),
  now: NOW,
  timeZone: TIME_ZONE,
  ...overrides,
});

describe('Kein Knopf ist stumm gesperrt', () => {
  it('begründet jede Sperre — an jedem Platz, in jeder Lage', () => {
    const situations: SlotViewContext[] = [
      // Keine Qualifikation für die Liga.
      context({ referee: makeReferee({ qualifications: [] }) }),
      // Schon selbst eingetragen.
      context({ slots: slotsFrom(['r-jk', 'b', null, null]) }),
      // Austragefrist abgelaufen.
      context({ game: makeGame({ kickoff: inDays(2) }), slots: slotsFrom(['r-jk', 'b', null, null]) }),
      // Am selben Tag schon im Einsatz.
      context({ sameDayAssignments: [makeGame({ id: 'anderes' })] }),
      // Anpfiff vorbei.
      context({ game: makeGame({ kickoff: inDays(-1) }) }),
      // Abgesagt.
      context({ game: makeGame({ state: 'cancelled' }) }),
    ];

    for (const situation of situations) {
      for (const view of slotViews(situation)) {
        if (view.action === 'blocked') {
          expect(view.reason.length, `Platz ${view.index} ohne Begründung`).toBeGreaterThan(10);
        } else {
          expect(view.reason).toBe('');
        }
      }
    }
  });

  it('gibt jedem Platz eine Beschriftung', () => {
    for (const view of slotViews(context({ slots: slotsFrom(['a', null, null, null]) }))) {
      expect(view.actionLabel.length).toBeGreaterThan(0);
      expect(view.role.length).toBeGreaterThan(0);
      expect(view.roleShort.length).toBeGreaterThan(0);
    }
  });
});

describe('Was an welchem Platz möglich ist', () => {
  it('bietet den ersten freien Platz zum Eintragen an', () => {
    const views = slotViews(context());
    expect(views[0]?.action).toBe('claim');
    expect(views[0]?.actionLabel).toBe('Eintragen');
  });

  it('nennt spätere Plätze „erst danach frei“ statt sie als gesperrt auszugeben', () => {
    // Ein Platz hinter dem nächsten freien ist nicht verboten, nur noch nicht dran.
    const views = slotViews(context());
    expect(views[1]?.action).toBe('blocked');
    expect(views[1]?.actionLabel).toBe('erst danach frei');
    expect(views[1]?.reason).toContain('der Reihe nach');
  });

  it('beschriftet den Ersatzplatz eigens', () => {
    const views = slotViews(context({ slots: slotsFrom(['a', 'b', null, null]) }));
    expect(views[2]?.action).toBe('claim');
    expect(views[2]?.actionLabel).toBe('Als Ersatz eintragen');
  });

  it('zeigt am eigenen Platz „Austragen“', () => {
    const views = slotViews(context({ slots: slotsFrom(['r-jk', null, null, null]) }));
    expect(views[0]).toMatchObject({ isMine: true, action: 'withdraw', actionLabel: 'Austragen' });
  });

  it('sperrt das Austragen nach der Frist, mit Begründung', () => {
    const views = slotViews(
      context({ game: makeGame({ kickoff: inDays(2) }), slots: slotsFrom(['r-jk', null, null, null]) }),
    );
    expect(views[0]?.action).toBe('blocked');
    expect(views[0]?.reason).toContain('21 Tage');
  });

  it('markiert fremde Belegungen als belegt', () => {
    const views = slotViews(context({ slots: slotsFrom(['r-lb', null, null, null]) }));
    expect(views[0]).toMatchObject({ action: 'occupied', isMine: false, occupantId: 'r-lb' });
  });

  it('gibt die Belegung als Id weiter, nicht als Name', () => {
    // Die Übersetzung in Kürzel oder Namen entscheidet die Sichtbarkeitsebene,
    // nicht diese Funktion.
    const views = slotViews(context({ slots: slotsFrom(['r-lb', null, null, null]) }));
    expect(views[0]?.occupantId).toBe('r-lb');
    expect(JSON.stringify(views)).not.toContain('Brandt');
  });
});

describe('Ersatz anfordern', () => {
  it('ist möglich, wenn man selbst eingetragen ist und ein Ersatz bereitsteht', () => {
    const view = substituteRequestView(context({ slots: slotsFrom(['r-jk', 'b', 'c', null]) }));
    expect(view.possible).toBe(true);
  });

  it('sagt, wer gefragt wird und was eine Zusage bedeutet', () => {
    /*
     * Frueher stand hier „die Nachricht geht an alle mit Qualifikation U14“.
     * Das war die alte Bedeutung des Knopfes; jetzt geht genau eine Nachricht
     * an genau eine Person, und der Hinweis muss beides nennen — wen es
     * trifft und was danach gilt.
     */
    const view = substituteRequestView(context({ slots: slotsFrom(['r-jk', 'b', 'c', null]) }));
    expect(view.note).toContain('Ersatz 1');
    expect(view.note).toContain('Schiedsrichter 1');
    expect(view.note).not.toContain('alle');
  });

  it('nennt den Ersatzplatz, der wirklich besetzt ist', () => {
    const view = substituteRequestView(context({ slots: slotsFrom(['r-jk', 'b', null, 'd']) }));
    expect(view.note).toContain('Ersatz 2');
  });

  it('begründet, warum es nicht geht', () => {
    const notIn = substituteRequestView(context({ slots: slotsFrom(['a', 'b', 'c', null]) }));
    expect(notIn.possible).toBe(false);
    expect(notIn.note).toContain('selbst');

    const noBench = substituteRequestView(context({ slots: slotsFrom(['r-jk', 'b', null, null]) }));
    expect(noBench.possible).toBe(false);
    expect(noBench.note).toContain('kein Ersatz');

    const tooLate = substituteRequestView(
      context({ game: makeGame({ kickoff: inDays(1) }), slots: slotsFrom(['r-jk', 'b', 'c', null]) }),
    );
    expect(tooLate.possible).toBe(false);
    expect(tooLate.note).toContain('gesperrt');
  });

  it('sperrt den Knopf, solange eine Anfrage läuft', () => {
    const view = substituteRequestView({
      ...context({ slots: slotsFrom(['r-jk', 'b', 'c', 'd']) }),
      pendingRequest: true,
    });
    expect(view.possible).toBe(false);
    expect(view.note).toContain('läuft schon');
  });
});
