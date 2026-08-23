import { describe, expect, it } from 'vitest';
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
  isQualified,
  qualifiedReferees,
  type ClaimContext,
} from './rules';

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

describe('Regel 8 — Ersatz anfordern bis drei Tage vor Anpfiff', () => {
  const request = (
    kickoff: Date,
    occupants: readonly (string | null)[] = ['r-jk', 'b', null, null],
    overrides = {},
  ) =>
    canRequestSubstitute({
      game: makeGame({ kickoff, ...overrides }),
      slots: slotsFrom(occupants),
      referee: makeReferee(),
      settings: settings(),
      now: NOW,
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
    const result = request(inDays(1), ['r-jk', 'b', null, null], {
      overrides: { withdraw: false, substituteRequest: true, oneGamePerDay: false },
    });
    expect(result.allowed).toBe(true);
  });

  it('lehnt ab, wenn die Person selbst nicht eingetragen ist', () => {
    expect(request(inDays(10), ['a', 'b', null, null])).toMatchObject({
      allowed: false,
      reason: 'not-assigned',
    });
  });

  it('lehnt ab, wenn beide Ersatzplaetze schon besetzt sind — die Nachricht haette keinen Adressaten', () => {
    expect(request(inDays(10), ['r-jk', 'b', 'c', 'd'])).toMatchObject({
      allowed: false,
      reason: 'no-open-substitute-slot',
    });
  });
});

describe('Regel 9 — beide Fristen sind vereinsweit einstellbar', () => {
  it('folgt einer verkuerzten Austragefrist', () => {
    const short = settings({ withdrawDeadlineDays: 7 });
    const context = {
      game: makeGame({ kickoff: inDays(10) }),
      slots: slotsFrom(['r-jk', 'b', null, null]),
      referee: makeReferee(),
      settings: short,
      now: NOW,
    };
    expect(canWithdraw(context).allowed).toBe(true);
    expect(canWithdraw({ ...context, settings: settings({ withdrawDeadlineDays: 21 }) })).toMatchObject(
      { allowed: false, reason: 'withdraw-deadline-passed' },
    );
  });

  it('folgt einer verlaengerten Ersatzfrist', () => {
    const context = {
      game: makeGame({ kickoff: inDays(5) }),
      slots: slotsFrom(['r-jk', 'b', null, null]),
      referee: makeReferee(),
      settings: settings({ substituteRequestDeadlineDays: 7 }),
      now: NOW,
    };
    expect(canRequestSubstitute(context)).toMatchObject({
      allowed: false,
      reason: 'substitute-request-deadline-passed',
    });
  });

  it('nennt die eingestellte Frist im Ablehnungstext, nicht eine fest verdrahtete Zahl', () => {
    const result = canWithdraw({
      game: makeGame({ kickoff: inDays(2) }),
      slots: slotsFrom(['r-jk', 'b', null, null]),
      referee: makeReferee(),
      settings: settings({ withdrawDeadlineDays: 14 }),
      now: NOW,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.message).toContain('14 Tage');
  });
});
