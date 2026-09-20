import { describe, expect, it } from 'vitest';
import { licenseCovers } from './license';
import {
  inDays,
  inHours,
  makeGame,
  makeReferee,
  NOW,
  settings,
  slotsFrom,
  TIME_ZONE,
} from './__fixtures__/build';
import {
  canClaimSlot,
  canRequestSubstitute,
  canWithdraw,
  claimableSlot,
  handoverSlot,
  isQualified,
  nextSubstituteToAsk,
  qualifiedReferees,
  type ClaimContext,
} from './rules';
import type { Game, Referee } from './types';

const claim = (overrides: Partial<ClaimContext> = {}) =>
  canClaimSlot({
    game: makeGame(),
    slots: slotsFrom([null, null, null, null]),
    referee: makeReferee(),
    slotIndex: 0,
    sameDayAssignments: [],
    settings: settings(),
    now: NOW,
    timeZone: TIME_ZONE,
    ...overrides,
  });

describe('Regel 3 — Eintragen ist verbindlich und nur auf freie Plaetze moeglich', () => {
  it('erlaubt den ersten freien Platz', () => {
    expect(claim().allowed).toBe(true);
  });

  it('lehnt einen bereits belegten Platz ab', () => {
    const result = claim({ slots: slotsFrom(['r-lb', null, null, null]), slotIndex: 0 });
    expect(result).toMatchObject({ allowed: false, reason: 'slot-taken' });
  });

  it('lehnt ab, wenn alle vier Plaetze besetzt sind', () => {
    const result = claim({ slots: slotsFrom(['a', 'b', 'c', 'd']), slotIndex: 0 });
    expect(result).toMatchObject({ allowed: false, reason: 'slot-taken' });
  });
});

describe('Regel 2 — nur der naechste freie Platz ist belegbar', () => {
  it('lehnt einen Ersatzplatz ab, solange ein Schiedsrichter-Platz frei ist', () => {
    const result = claim({ slots: slotsFrom(['r-lb', null, null, null]), slotIndex: 2 });
    expect(result).toMatchObject({ allowed: false, reason: 'slot-out-of-order' });
  });

  it('nennt in der Ablehnung den Platz, der tatsaechlich frei ist', () => {
    const result = claim({ slots: slotsFrom(['r-lb', null, null, null]), slotIndex: 3 });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.message).toContain('Schiedsrichter 2');
  });

  it('erlaubt Ersatz 1, sobald beide Schiedsrichter stehen', () => {
    expect(claim({ slots: slotsFrom(['a', 'b', null, null]), slotIndex: 2 }).allowed).toBe(true);
  });
});

describe('Regel 4 — Qualifikation ist Pflicht', () => {
  it('lehnt ohne passende Liga ab', () => {
    const referee = makeReferee({ qualifications: ['U16'] });
    expect(claim({ referee })).toMatchObject({ allowed: false, reason: 'not-qualified' });
  });

  it('prueft die Liga des Spiels, nicht irgendeine', () => {
    const referee = makeReferee({ qualifications: ['U14'] });
    expect(isQualified(referee, 'U14')).toBe(true);
    expect(isQualified(referee, 'Erwachsene')).toBe(false);
  });

  it('laesst sich nicht ueber Einstellungen abschalten', () => {
    // In ClubSettings gibt es bewusst keinen Schalter dafuer. Der Test haelt
    // das fest: auch mit sonst maximal offenen Einstellungen bleibt es gesperrt.
    const result = claim({
      referee: makeReferee({ qualifications: [] }),
      settings: settings({ oneGamePerDay: false, rotation: false }),
    });
    expect(result).toMatchObject({ allowed: false, reason: 'not-qualified' });
  });

  it('listet nur aktive, qualifizierte Personen', () => {
    const refs = [
      makeReferee({ id: 'a', qualifications: ['U14'] }),
      makeReferee({ id: 'b', qualifications: ['U16'] }),
      makeReferee({ id: 'c', qualifications: ['U14'], active: false }),
    ];
    expect(qualifiedReferees(refs, 'U14').map((r) => r.id)).toEqual(['a']);
  });
});

describe('Die Lizenz entscheidet ueber das Eintragen, nicht ueber das Sehen', () => {
  /*
   * E ist die niedrigste Lizenz, darueber D, darueber C. Jede deckt die
   * niedrigeren mit ab, keine die hoeheren. Wer gar keine hat, kann sich in
   * kein Spiel eintragen — auch nicht in eines seiner Liga. Am Spielplan
   * aendert das nichts: den sieht jeder vollstaendig.
   */
  it('rechnet die hoehere Lizenz auf die niedrigeren an, aber nie umgekehrt', () => {
    expect(licenseCovers('C', 'C')).toBe(true);
    expect(licenseCovers('C', 'D')).toBe(true);
    expect(licenseCovers('C', 'E')).toBe(true);
    expect(licenseCovers('D', 'D')).toBe(true);
    expect(licenseCovers('D', 'E')).toBe(true);
    expect(licenseCovers('E', 'E')).toBe(true);

    expect(licenseCovers('D', 'C')).toBe(false);
    expect(licenseCovers('E', 'C')).toBe(false);
    expect(licenseCovers('E', 'D')).toBe(false);
    expect(licenseCovers(null, 'E')).toBe(false);
  });

  it('vergleicht den Rang und nicht den Buchstaben', () => {
    // Alphabetisch stuende C vor D und E — der Rangfolge nach darueber.
    expect(licenseCovers('C', 'E')).toBe(true);
    expect(licenseCovers('E', 'C')).toBe(false);
  });

  it('sperrt ein C-Spiel gegen D und E', () => {
    for (const license of ['D', 'E'] as const) {
      const referee = makeReferee({ qualifications: ['U14'], license });
      expect(claim({ referee, game: makeGame({ requiredLicense: 'C' }) })).toMatchObject({
        allowed: false,
        reason: 'license-too-low',
      });
    }
  });

  it('laesst C jedes Spiel pfeifen', () => {
    const referee = makeReferee({ qualifications: ['U14'], license: 'C' });
    for (const requiredLicense of ['C', 'D', 'E'] as const) {
      expect(claim({ referee, game: makeGame({ requiredLicense }) }).allowed).toBe(true);
    }
  });

  it('lehnt ohne Lizenz jedes Spiel ab', () => {
    const referee = makeReferee({ qualifications: ['U14'], license: null });
    expect(claim({ referee })).toMatchObject({ allowed: false, reason: 'license-missing' });
  });

  it('lehnt ein D-Spiel gegenueber einer E-Lizenz ab', () => {
    const referee = makeReferee({ qualifications: ['U14'], license: 'E' });
    const result = claim({ referee, game: makeGame({ requiredLicense: 'D' }) });
    expect(result).toMatchObject({ allowed: false, reason: 'license-too-low' });
  });

  it('laesst die hoehere Lizenz auch das niedrigere Spiel pfeifen', () => {
    const referee = makeReferee({ qualifications: ['U14'], license: 'D' });
    expect(claim({ referee, game: makeGame({ requiredLicense: 'E' }) }).allowed).toBe(true);
  });

  it('nennt zuerst die fehlende Qualifikation — sie ist der grundlegendere Grund', () => {
    const referee = makeReferee({ qualifications: [], license: null });
    expect(claim({ referee })).toMatchObject({ allowed: false, reason: 'not-qualified' });
  });

  it('laesst bei der Kandidatenliste aus, wem die Lizenz fehlt', () => {
    const refs = [
      makeReferee({ id: 'a', qualifications: ['U14'], license: 'D' }),
      makeReferee({ id: 'b', qualifications: ['U14'], license: 'E' }),
      makeReferee({ id: 'c', qualifications: ['U14'], license: null }),
      makeReferee({ id: 'd', qualifications: ['U14'], license: 'C' }),
    ];
    expect(qualifiedReferees(refs, 'U14', 'C').map((r) => r.id)).toEqual(['d']);
    expect(qualifiedReferees(refs, 'U14', 'D').map((r) => r.id)).toEqual(['a', 'd']);
    expect(qualifiedReferees(refs, 'U14', 'E').map((r) => r.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('Regel 5 — kein zweiter Platz im selben Spiel', () => {
  it('lehnt ab, wenn die Person schon als Schiedsrichter eingetragen ist', () => {
    const result = claim({ slots: slotsFrom(['r-jk', 'b', null, null]), slotIndex: 2 });
    expect(result).toMatchObject({ allowed: false, reason: 'already-assigned' });
  });

  it('lehnt auch ab, wenn die Person schon Ersatz ist', () => {
    const result = claim({ slots: slotsFrom([null, 'b', 'r-jk', null]), slotIndex: 0 });
    expect(result).toMatchObject({ allowed: false, reason: 'already-assigned' });
  });
});

describe('Regel 6 — max. ein Spiel pro Tag', () => {
  const kickoff = new Date('2026-09-12T08:30:00Z');
  const sameDay = makeGame({ id: 'other', kickoff: new Date('2026-09-12T12:00:00Z') });

  it('lehnt ein zweites Spiel am selben Kalendertag ab', () => {
    const result = claim({
      game: makeGame({ kickoff }),
      sameDayAssignments: [sameDay],
    });
    expect(result).toMatchObject({ allowed: false, reason: 'one-game-per-day' });
  });

  it('zaehlt auch Ersatz-Eintragungen mit — die Quelle uebergibt sie gleichberechtigt', () => {
    const result = claim({
      game: makeGame({ kickoff }),
      sameDayAssignments: [sameDay],
      slots: slotsFrom(['a', 'b', null, null]),
      slotIndex: 2,
    });
    expect(result).toMatchObject({ allowed: false, reason: 'one-game-per-day' });
  });

  it('erlaubt ein Spiel am Vortag', () => {
    const result = claim({
      game: makeGame({ kickoff }),
      sameDayAssignments: [makeGame({ id: 'other', kickoff: new Date('2026-09-11T18:00:00Z') })],
    });
    expect(result.allowed).toBe(true);
  });

  it('ignoriert abgesagte Spiele', () => {
    const result = claim({
      game: makeGame({ kickoff }),
      sameDayAssignments: [{ ...sameDay, state: 'cancelled' }],
    });
    expect(result.allowed).toBe(true);
  });

  it('greift nicht, wenn die Regel vereinsweit aus ist', () => {
    const result = claim({
      game: makeGame({ kickoff }),
      sameDayAssignments: [sameDay],
      settings: settings({ oneGamePerDay: false }),
    });
    expect(result.allowed).toBe(true);
  });

  it('greift nicht, wenn der Admin das Spiel freigegeben hat', () => {
    const result = claim({
      game: makeGame({
        kickoff,
        overrides: { withdraw: false, substituteRequest: false, oneGamePerDay: true },
      }),
      sameDayAssignments: [sameDay],
    });
    expect(result.allowed).toBe(true);
  });

  it('rechnet Kalendertage in der Vereinszeitzone, nicht in UTC', () => {
    // 22:30 UTC ist in Europe/Berlin bereits der Folgetag (00:30 MESZ).
    const lateUtc = new Date('2026-09-12T22:30:00Z');
    const result = claim({
      game: makeGame({ kickoff: lateUtc }),
      sameDayAssignments: [makeGame({ id: 'other', kickoff: new Date('2026-09-12T12:00:00Z') })],
    });
    expect(result.allowed).toBe(true);
  });
});

describe('Vorbedingungen fuer jede Aenderung', () => {
  it('lehnt abgesagte Spiele ab', () => {
    expect(claim({ game: makeGame({ state: 'cancelled' }) })).toMatchObject({
      allowed: false,
      reason: 'game-cancelled',
    });
  });

  it('lehnt Spiele ab, deren Anpfiff vorbei ist', () => {
    expect(claim({ game: makeGame({ kickoff: inHours(-1) }) })).toMatchObject({
      allowed: false,
      reason: 'kickoff-passed',
    });
  });

  it('begruendet jede Ablehnung mit einem Text fuer den Nutzer', () => {
    const cases = [
      claim({ game: makeGame({ state: 'cancelled' }) }),
      claim({ referee: makeReferee({ qualifications: [] }) }),
      claim({ slots: slotsFrom(['r-jk', null, null, null]), slotIndex: 1 }),
      claim({ slots: slotsFrom(['r-lb', null, null, null]), slotIndex: 2 }),
    ];
    for (const result of cases) {
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.message.length).toBeGreaterThan(10);
    }
  });
});

describe('claimableSlot', () => {
  it('nennt den Platz, den die Person tatsaechlich belegen darf', () => {
    expect(
      claimableSlot({
        game: makeGame(),
        slots: slotsFrom(['a', 'b', null, null]),
        referee: makeReferee(),
        sameDayAssignments: [],
        settings: settings(),
        now: NOW,
        timeZone: TIME_ZONE,
      })?.index,
    ).toBe(2);
  });

  it('gibt null zurueck, wenn keine Eintragung moeglich ist', () => {
    expect(
      claimableSlot({
        game: makeGame(),
        slots: slotsFrom([null, null, null, null]),
        referee: makeReferee({ qualifications: [] }),
        sameDayAssignments: [],
        settings: settings(),
        now: NOW,
        timeZone: TIME_ZONE,
      }),
    ).toBeNull();
  });
});

describe('Regel 7 — Austragen bis drei Wochen vor Anpfiff', () => {
  const withdraw = (kickoff: Date, overrides = {}) =>
    canWithdraw({
      game: makeGame({ kickoff, ...overrides }),
      slots: slotsFrom(['r-jk', 'b', null, null]),
      referee: makeReferee(),
      settings: settings(),
      now: NOW,
    });

  it('erlaubt es deutlich vor der Frist', () => {
    expect(withdraw(inDays(30)).allowed).toBe(true);
  });

  it('erlaubt es an der Frist auf die Sekunde genau', () => {
    expect(withdraw(inDays(21)).allowed).toBe(true);
  });

  it('sperrt eine Sekunde nach der Frist', () => {
    const kickoff = new Date(inDays(21).getTime() - 1000);
    expect(withdraw(kickoff)).toMatchObject({
      allowed: false,
      reason: 'withdraw-deadline-passed',
    });
  });

  it('erlaubt es innerhalb der Frist, wenn der Admin freigegeben hat', () => {
    const kickoff = inDays(2);
    const result = withdraw(kickoff, {
      overrides: { withdraw: true, substituteRequest: false, oneGamePerDay: false },
    });
    expect(result.allowed).toBe(true);
  });

  it('lehnt ab, wenn die Person gar nicht eingetragen ist', () => {
    const result = canWithdraw({
      game: makeGame(),
      slots: slotsFrom(['a', 'b', null, null]),
      referee: makeReferee(),
      settings: settings(),
      now: NOW,
    });
    expect(result).toMatchObject({ allowed: false, reason: 'not-assigned' });
  });
});

describe('Regel 8 — Ersatz anfordern heisst: das Spiel abgeben', () => {
  /*
   * Was der Knopf tut, hat sich umgedreht. Frueher rief er weitere Leute auf,
   * sich als Ersatz **einzutragen**, und verlangte dafuer einen *freien*
   * Ersatzplatz. Jetzt fragt er den vordersten eingetragenen Ersatz, ob er das
   * Spiel **uebernimmt** — und verlangt dafuer einen *besetzten*.
   */
  const request = (
    kickoff: Date,
    occupants: readonly (string | null)[] = ['r-jk', 'b', 'c', null],
    extra: {
      overrides?: Game['overrides'];
      referee?: Referee;
      pendingRequest?: boolean;
    } = {},
  ) =>
    canRequestSubstitute({
      game: makeGame(extra.overrides ? { kickoff, overrides: extra.overrides } : { kickoff }),
      slots: slotsFrom(occupants),
      referee: extra.referee ?? makeReferee(),
      settings: settings(),
      now: NOW,
      ...(extra.pendingRequest === undefined ? {} : { pendingRequest: extra.pendingRequest }),
    });

  it('erlaubt es deutlich vor der Frist', () => {
    expect(request(inDays(10)).allowed).toBe(true);
  });

  it('erlaubt es an der Frist auf die Sekunde genau', () => {
    expect(request(inDays(3)).allowed).toBe(true);
  });

  it('sperrt eine Sekunde nach der Frist', () => {
    expect(request(new Date(inDays(3).getTime() - 1000))).toMatchObject({
      allowed: false,
      reason: 'substitute-request-deadline-passed',
    });
  });

  it('erlaubt es nach der Frist, wenn der Admin freigegeben hat', () => {
    const result = request(inDays(1), ['r-jk', 'b', 'c', null], {
      overrides: { withdraw: false, substituteRequest: true, oneGamePerDay: false },
    });
    expect(result.allowed).toBe(true);
  });

  it('erlaubt es auch von Schiri 2 aus', () => {
    expect(request(inDays(10), ['a', 'r-jk', 'c', null]).allowed).toBe(true);
  });

  it('lehnt ab, wenn die Person selbst nicht eingetragen ist', () => {
    expect(request(inDays(10), ['a', 'b', 'c', null])).toMatchObject({
      allowed: false,
      reason: 'not-assigned',
    });
  });

  it('lehnt ab, wenn die Person nur auf einem Ersatzplatz steht', () => {
    /*
     * Abgeben kann nur, wer etwas abzugeben hat. Ein Ersatz traegt sich aus,
     * er reicht das Spiel nicht weiter.
     */
    expect(request(inDays(10), ['a', 'b', 'r-jk', 'c'])).toMatchObject({
      allowed: false,
      reason: 'not-assigned',
    });
  });

  it('lehnt ab, wenn kein Ersatz eingetragen ist — es gibt niemanden zu fragen', () => {
    expect(request(inDays(10), ['r-jk', 'b', null, null])).toMatchObject({
      allowed: false,
      reason: 'no-substitute-available',
    });
  });

  it('erlaubt es, wenn nur Ersatz 2 besetzt ist', () => {
    /*
     * Eine Luecke auf der Bank ist kein Grund, niemanden zu fragen — gefragt
     * wird der vorderste *besetzte* Platz, nicht stur Ersatz 1.
     */
    expect(request(inDays(10), ['r-jk', 'b', null, 'd']).allowed).toBe(true);
  });

  it('lehnt eine zweite Anfrage ab, solange die erste laeuft', () => {
    expect(request(inDays(10), ['r-jk', 'b', 'c', 'd'], { pendingRequest: true })).toMatchObject({
      allowed: false,
      reason: 'request-running',
    });
  });

  it('lehnt ab, wenn das Spiel abgesagt ist', () => {
    const result = canRequestSubstitute({
      game: makeGame({ kickoff: inDays(10), state: 'cancelled' }),
      slots: slotsFrom(['r-jk', 'b', 'c', null]),
      referee: makeReferee(),
      settings: settings(),
      now: NOW,
    });
    expect(result).toMatchObject({ allowed: false, reason: 'game-cancelled' });
  });

  it('lehnt nach dem Anpfiff ab', () => {
    expect(request(inDays(-1))).toMatchObject({ allowed: false, reason: 'kickoff-passed' });
  });
});

describe('Regel 8 — derselbe Vorgang, ausgeloest vom Admin', () => {
  const admin = makeReferee({ id: 'r-admin', role: 'admin' });

  const request = (occupants: readonly (string | null)[]) =>
    canRequestSubstitute({
      game: makeGame({ kickoff: inDays(10) }),
      slots: slotsFrom(occupants),
      referee: admin,
      settings: settings(),
      now: NOW,
    });

  it('erlaubt es fuer einen geraeumten Schiedsrichter-Platz', () => {
    expect(request([null, 'b', 'c', null]).allowed).toBe(true);
  });

  it('verlangt, dass vorher jemand ausgetragen wurde', () => {
    /*
     * Solange beide Plaetze besetzt sind, gibt es nichts abzugeben. Der Admin
     * traegt erst jemanden aus — dann steht der Platz leer und kann an den
     * Ersatz gehen.
     */
    expect(request(['a', 'b', 'c', null])).toMatchObject({
      allowed: false,
      reason: 'not-assigned',
    });
  });

  it('gibt den eigenen Platz ab, wenn der Admin selbst eingeteilt ist', () => {
    /*
     * Ein Admin, der selbst pfeift, geht denselben Weg wie jeder andere:
     * abgegeben wird sein Platz, nicht irgendein leerer.
     */
    const slots = slotsFrom(['r-admin', null, 'c', null]);
    expect(handoverSlot(slots, admin)?.index).toBe(0);
  });

  it('braucht auch beim Admin einen eingetragenen Ersatz', () => {
    expect(request([null, 'b', null, null])).toMatchObject({
      allowed: false,
      reason: 'no-substitute-available',
    });
  });
});

describe('Wer als naechstes gefragt wird', () => {
  it('nimmt den vordersten besetzten Ersatzplatz', () => {
    expect(nextSubstituteToAsk(slotsFrom(['a', 'b', 'c', 'd']))?.index).toBe(2);
  });

  it('ueberspringt eine Luecke auf der Bank', () => {
    expect(nextSubstituteToAsk(slotsFrom(['a', 'b', null, 'd']))?.index).toBe(3);
  });

  it('meldet eine leere Bank als null', () => {
    expect(nextSubstituteToAsk(slotsFrom(['a', 'b', null, null]))).toBeNull();
  });

  it('sieht Schiedsrichter-Plaetze nicht als Ersatz an', () => {
    expect(nextSubstituteToAsk(slotsFrom(['a', 'b', null, null]))).toBeNull();
  });
});
