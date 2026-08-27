import { describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_SETTINGS } from './alerts';
import {
  DIGEST_HOUR,
  NUDGE_LEAD_DAYS,
  dueConfirmationAlerts,
  dueConfirmations,
  dueDigest,
  duePersonalReminders,
  nudgeRound,
  openSlotAnnouncement,
  planNotifications,
  planPromotions,
  type PromotionOfferRecord,
  type ScheduledGame,
  type SchedulerInput,
} from './scheduler';
import { totalCostUnits } from './notifications';
import {
  NOW,
  TIME_ZONE,
  inDays,
  inHours,
  makeGame,
  makeReferee,
  settings,
  slotsFrom,
} from './__fixtures__/build';
import type { Referee, Slot } from './types';

/**
 * Der Nachrichtenplan im Trockenlauf.
 *
 * Kein Test hier fasst eine Datenbank oder ein Netz an. Das ist der Punkt:
 * jede Nachricht kostet den Verein Geld (Regel 33), also muss vorher pruefbar
 * sein, welche Nachrichten ein Lauf ausloesen wuerde.
 */

const entry = (over: Partial<ScheduledGame> = {}): ScheduledGame => ({
  game: makeGame({ kickoff: inDays(10) }),
  slots: slotsFrom([null, null, null, null]),
  offers: [],
  ...over,
});

const refereeMap = (...list: readonly Referee[]): ReadonlyMap<string, Referee> =>
  new Map(list.map((r) => [r.id, r]));

const input = (over: Partial<SchedulerInput> = {}): SchedulerInput => ({
  games: [],
  referees: [],
  appearances: new Map(),
  settings: settings(),
  alerts: DEFAULT_ALERT_SETTINGS,
  timeZone: TIME_ZONE,
  ...over,
});

describe('Regel 21 — persoenliche Erinnerungen', () => {
  const jk = makeReferee({ id: 'r-jk', reminderHours: [168, 24] });

  it('schickt die Erinnerung, sobald ihr Vorlauf erreicht ist', () => {
    const game = makeGame({ kickoff: inHours(20) });
    const intents = duePersonalReminders(
      entry({ game, slots: slotsFrom(['r-jk', null, null, null]) }),
      refereeMap(jk),
      NOW,
    );
    expect(intents.map((i) => i.payload['hoursBefore'])).toEqual([24]);
  });

  it('schickt nichts, solange der Vorlauf nicht erreicht ist', () => {
    const game = makeGame({ kickoff: inDays(30) });
    const intents = duePersonalReminders(
      entry({ game, slots: slotsFrom(['r-jk', null, null, null]) }),
      refereeMap(jk),
      NOW,
    );
    expect(intents).toEqual([]);
  });

  it('schweigt nach dem Anpfiff — eine Erinnerung an ein gelaufenes Spiel waere Unsinn', () => {
    const game = makeGame({ kickoff: inHours(-1) });
    const intents = duePersonalReminders(
      entry({ game, slots: slotsFrom(['r-jk', null, null, null]) }),
      refereeMap(jk),
      NOW,
    );
    expect(intents).toEqual([]);
  });

  it('holt keine Erinnerung nach, deren Zeitpunkt vor der Eintragung lag', () => {
    /*
     * Der Vorlauf von sieben Tagen ist gerade eben verstrichen und laege noch
     * im Nachlauf — aber die Person hat sich erst danach eingetragen. Diese
     * Nachricht darf nicht rausgehen: sie waere inhaltlich falsch und kostet
     * trotzdem Geld.
     */
    const game = makeGame({ kickoff: inHours(166) });
    const slots = slotsFrom(['r-jk', null, null, null], (a) => ({
      ...a,
      claimedAt: inHours(-1),
    }));
    expect(duePersonalReminders(entry({ game, slots }), refereeMap(jk), NOW)).toEqual([]);
  });

  it('holt eine laengst verstrichene Erinnerung nicht mehr nach', () => {
    // Der 7-Tage-Vorlauf liegt sechs Tage zurueck. Sie jetzt zu verschicken
    // hiesse, sechs Tage zu spaet "in 7 Tagen" zu schreiben.
    const game = makeGame({ kickoff: inHours(20) });
    const intents = duePersonalReminders(
      entry({ game, slots: slotsFrom(['r-jk', null, null, null]) }),
      refereeMap(jk),
      NOW,
    );
    expect(intents.map((i) => i.payload['hoursBefore'])).toEqual([24]);
  });

  it('schweigt fuer stillgelegte Personen', () => {
    const game = makeGame({ kickoff: inHours(20) });
    const intents = duePersonalReminders(
      entry({ game, slots: slotsFrom(['r-jk', null, null, null]) }),
      refereeMap({ ...jk, active: false }),
      NOW,
    );
    expect(intents).toEqual([]);
  });

  it('erinnert auch Ersatzleute — sie sollen den Termin kennen', () => {
    const game = makeGame({ kickoff: inHours(20) });
    const intents = duePersonalReminders(
      entry({ game, slots: slotsFrom([null, null, 'r-jk', null]) }),
      refereeMap(jk),
      NOW,
    );
    expect(intents).toHaveLength(1);
    expect(intents[0]?.recipientIds).toEqual(['r-jk']);
  });
});

describe('Regeln 10 und 11 — Pflichtbestaetigung und Nachfassen', () => {
  const withReferees = (kickoff: Date): ScheduledGame =>
    entry({ game: makeGame({ kickoff }), slots: slotsFrom(['r-jk', 'r-ms', null, null]) });

  it('fragt beide Schiedsrichter, sobald der Vorlauf erreicht ist', () => {
    const intents = dueConfirmations(withReferees(inHours(70)), settings(), NOW);
    expect(intents.map((i) => i.kind)).toEqual(['confirmation-request', 'confirmation-request']);
  });

  it('fragt vor dem Vorlauf noch niemanden', () => {
    expect(dueConfirmations(withReferees(inHours(80)), settings(), NOW)).toEqual([]);
  });

  it('fasst nach, wenn die Antwort nach der Nachfassfrist ausbleibt', () => {
    const intents = dueConfirmations(withReferees(inHours(40)), settings(), NOW);
    expect(intents.filter((i) => i.kind === 'confirmation-follow-up')).toHaveLength(2);
  });

  it('laesst Ersatzleute in Ruhe — Regel 12', () => {
    const game = entry({
      game: makeGame({ kickoff: inHours(40) }),
      slots: slotsFrom([null, null, 'r-tf', 'r-ay']),
    });
    expect(dueConfirmations(game, settings(), NOW)).toEqual([]);
  });

  it('schweigt, sobald bestaetigt wurde', () => {
    const slots = slotsFrom(['r-jk', null, null, null], (a) => ({ ...a, confirmedAt: NOW }));
    const game = entry({ game: makeGame({ kickoff: inHours(40) }), slots });
    expect(dueConfirmations(game, settings(), NOW)).toEqual([]);
  });

  it('meldet die ueberfaellige Bestaetigung an die Admins', () => {
    const alerts = dueConfirmationAlerts(
      withReferees(inHours(40)),
      settings(),
      DEFAULT_ALERT_SETTINGS,
      ['r-admin'],
      refereeMap(makeReferee({ id: 'r-jk', name: 'Jonas Keller' })),
      TIME_ZONE,
      NOW,
    );
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.recipientIds).toEqual(['r-admin']);
    expect(String(alerts[0]?.payload['detail'])).toContain('Jonas Keller');
  });

  it('meldet zwei offene Bestaetigungen als zwei Meldungen, nicht als eine', () => {
    const alerts = dueConfirmationAlerts(
      withReferees(inHours(40)),
      settings(),
      DEFAULT_ALERT_SETTINGS,
      ['r-admin'],
      refereeMap(),
      TIME_ZONE,
      NOW,
    );
    expect(new Set(alerts.map((a) => a.key)).size).toBe(2);
  });

  it('schweigt, wenn der Admin diese Meldung abgeschaltet hat', () => {
    const alerts = dueConfirmationAlerts(
      withReferees(inHours(40)),
      settings(),
      { ...DEFAULT_ALERT_SETTINGS, confirmationOverdue: false },
      ['r-admin'],
      refereeMap(),
      TIME_ZONE,
      NOW,
    );
    expect(alerts).toEqual([]);
  });
});

describe('Regeln 13 bis 15 — die Nachrueck-Kaskade laeuft von allein weiter', () => {
  const offer = (over: Partial<PromotionOfferRecord> = {}): PromotionOfferRecord => ({
    id: 'o1',
    gameId: 'g1',
    targetSlot: 0,
    substituteSlot: 2,
    refereeId: 'r-tf',
    respondBy: inHours(5),
    outcome: 'pending',
    ...over,
  });

  const gap: readonly Slot[] = slotsFrom([null, 'r-ms', 'r-tf', 'r-ay']);

  it('fragt Ersatz 1, sobald ein Schiedsrichter-Platz frei ist', () => {
    const plan = planPromotions(entry({ slots: gap }), settings(), NOW);
    expect(plan.newOffers).toHaveLength(1);
    expect(plan.newOffers[0]?.refereeId).toBe('r-tf');
    expect(plan.newOffers[0]?.targetSlot).toBe(0);
  });

  it('wartet, solange die Frist der laufenden Anfrage nicht verstrichen ist', () => {
    const plan = planPromotions(entry({ slots: gap, offers: [offer()] }), settings(), NOW);
    expect(plan.newOffers).toEqual([]);
    expect(plan.expiredOfferIds).toEqual([]);
    expect(plan.announce).toBe(false);
  });

  it('geht nach Fristablauf zu Ersatz 2 weiter und merkt sich den Ablauf', () => {
    const plan = planPromotions(
      entry({ slots: gap, offers: [offer({ respondBy: inHours(-1) })] }),
      settings(),
      NOW,
    );
    expect(plan.expiredOfferIds).toEqual(['o1']);
    expect(plan.newOffers[0]?.refereeId).toBe('r-ay');
    expect(plan.newOffers[0]?.substituteSlot).toBe(3);
  });

  it('fragt niemanden zweimal, der schon abgelehnt hat', () => {
    const plan = planPromotions(
      entry({
        slots: gap,
        offers: [
          offer({ id: 'o1', substituteSlot: 2, outcome: 'declined' }),
          offer({ id: 'o2', substituteSlot: 3, refereeId: 'r-ay', outcome: 'declined' }),
        ],
      }),
      settings(),
      NOW,
    );
    expect(plan.newOffers).toEqual([]);
    expect(plan.announce).toBe(true);
  });

  it('schreibt sofort aus, wenn es gar keinen Ersatz gibt', () => {
    const plan = planPromotions(
      entry({ slots: slotsFrom([null, 'r-ms', null, null]) }),
      settings(),
      NOW,
    );
    expect(plan.announce).toBe(true);
  });

  it('tut nichts, wenn beide Schiedsrichter-Plaetze besetzt sind', () => {
    const plan = planPromotions(
      entry({ slots: slotsFrom(['r-jk', 'r-ms', null, null]) }),
      settings(),
      NOW,
    );
    expect(plan).toEqual({ expiredOfferIds: [], newOffers: [], announce: false });
  });

  it('ruehrt ein abgesagtes Spiel nicht an', () => {
    const plan = planPromotions(
      entry({ game: makeGame({ kickoff: inDays(10), state: 'cancelled' }), slots: gap }),
      settings(),
      NOW,
    );
    expect(plan).toEqual({ expiredOfferIds: [], newOffers: [], announce: false });
  });
});

describe('Regeln 19 und 32 — die Ausschreibung und ihre Reihenfolge', () => {
  const gap = slotsFrom([null, 'r-ms', null, null]);
  const jk = makeReferee({ id: 'r-jk', name: 'Jonas Keller', qualifications: ['U14'] });
  const nb = makeReferee({ id: 'r-nb', name: 'Nina Bauer', qualifications: ['U14'] });
  const ms = makeReferee({ id: 'r-ms', name: 'Marc Sommer', qualifications: ['U14'] });

  it('stellt die Wenig-Pfeifer nach vorn — Regel 19', () => {
    const intent = openSlotAnnouncement(
      entry({ slots: gap }),
      [jk, nb],
      new Map([
        ['r-jk', 4],
        ['r-nb', 1],
      ]),
      settings({ rotation: true }),
      NOW,
    );
    expect(intent?.recipientIds).toEqual(['r-nb', 'r-jk']);
  });

  it('laesst die Reihenfolge unangetastet, wenn die Rotation aus ist', () => {
    const intent = openSlotAnnouncement(
      entry({ slots: gap }),
      [jk, nb],
      new Map([['r-jk', 4]]),
      settings({ rotation: false }),
      NOW,
    );
    expect(intent?.recipientIds).toEqual(['r-jk', 'r-nb']);
  });

  it('schreibt niemanden an, der in diesem Spiel schon steht', () => {
    const intent = openSlotAnnouncement(
      entry({ slots: gap }),
      [jk, ms],
      new Map(),
      settings(),
      NOW,
    );
    expect(intent?.recipientIds).toEqual(['r-jk']);
  });

  it('laesst Unqualifizierte aus — Regel 4', () => {
    const fremd = makeReferee({ id: 'r-x', name: 'Ohne U14', qualifications: ['U18'] });
    const intent = openSlotAnnouncement(
      entry({ slots: gap }),
      [jk, fremd],
      new Map(),
      settings(),
      NOW,
    );
    expect(intent?.recipientIds).toEqual(['r-jk']);
  });

  it('erhoeht die Stufe, je naeher der Anpfiff rueckt', () => {
    const kickoff = inDays(20);
    expect(nudgeRound(kickoff, NOW)).toBe(0);
    expect(nudgeRound(kickoff, inDays(20 - NUDGE_LEAD_DAYS[0]!))).toBe(1);
    expect(nudgeRound(kickoff, inDays(20 - NUDGE_LEAD_DAYS[3]!))).toBe(4);
  });

  it('holt nach einem Ausfall nicht alle verpassten Stufen auf einmal nach', () => {
    // Zwei Tage vor Anpfiff sind die Stufen 14, 7 und 3 Tage saemtlich
    // ueberschritten. Trotzdem darf nur eine Nachricht entstehen.
    expect(nudgeRound(inDays(2), NOW)).toBe(3);
  });

  it('die erste Ausschreibung haengt nicht am Schalter fuer die Nachfrage', () => {
    const intent = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(20) }), slots: gap }),
      [jk],
      new Map(),
      settings({ autoNudge: false }),
      NOW,
    );
    expect(intent).not.toBeNull();
  });

  it('schweigt ganz, wenn der Verein die Ausschreibung abgeschaltet hat', () => {
    const intent = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(20) }), slots: gap }),
      [jk],
      new Map(),
      settings({ openSlotVisibility: 'off' }),
      NOW,
    );
    expect(intent).toBeNull();
  });

  it('schreibt bei "nur Admins" allein den Admins aus — auch ohne Qualifikation', () => {
    const admin = makeReferee({ id: 'r-admin', role: 'admin', qualifications: ['U18'] });
    const intent = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(20) }), slots: gap }),
      [jk, admin],
      new Map(),
      settings({ openSlotVisibility: 'admins' }),
      NOW,
    );
    expect(intent?.recipientIds).toEqual(['r-admin']);
    expect(intent?.payload['audience']).toBe('admins');
  });

  it('laesst bei "nur Admins" stillgelegte Admins aus', () => {
    const admin = makeReferee({ id: 'r-admin', role: 'admin', active: false });
    const intent = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(20) }), slots: gap }),
      [jk, admin],
      new Map(),
      settings({ openSlotVisibility: 'admins' }),
      NOW,
    );
    expect(intent).toBeNull();
  });

  it('die Wiederholung dagegen schon — sie kostet erneut Geld', () => {
    const intent = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(5) }), slots: gap }),
      [jk],
      new Map(),
      settings({ autoNudge: false }),
      NOW,
    );
    expect(intent).toBeNull();
  });

  it('trennt zwei Luecken desselben Spiels — sonst bliebe die zweite stumm', () => {
    const first = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(20) }), slots: gap }),
      [jk],
      new Map(),
      settings(),
      NOW,
    );
    const second = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(20), vacancyVersion: 1 }), slots: gap }),
      [jk],
      new Map(),
      settings(),
      NOW,
    );
    expect(first?.key).not.toBe(second?.key);
  });

  it('schweigt, wenn niemand mehr in Frage kommt', () => {
    const intent = openSlotAnnouncement(entry({ slots: gap }), [ms], new Map(), settings(), NOW);
    expect(intent).toBeNull();
  });
});

describe('Regel 20 — die Tageszusammenfassung', () => {
  const abends = new Date('2026-08-01T17:00:00Z'); // 19 Uhr Ortszeit
  const morgens = new Date('2026-08-01T06:00:00Z'); // 8 Uhr Ortszeit
  const admin = makeReferee({ id: 'r-admin', role: 'admin' });

  const offen = (now: Date): SchedulerInput =>
    input({
      games: [entry({ game: makeGame({ kickoff: inDays(10, now) }) })],
      referees: [admin],
    });

  it('geht erst ab der eingestellten Ortszeit raus', () => {
    expect(dueDigest(offen(morgens), ['r-admin'], morgens)).toBeNull();
    expect(dueDigest(offen(abends), ['r-admin'], abends)).not.toBeNull();
  });

  it('traegt den Kalendertag in Vereinszeit im Schluessel', () => {
    expect(dueDigest(offen(abends), ['r-admin'], abends)?.key).toBe('digest:2026-08-01');
  });

  it('richtet sich nach der Ortszeit, nicht nach UTC', () => {
    /*
     * Kurz nach Mitternacht Ortszeit ist der Abend vorbei. In UTC waere es
     * noch der Vortag um 22:30 und damit scheinbar "abends" — die Nachricht
     * ginge zur falschen Tageszeit raus.
     */
    const nachMitternacht = new Date('2026-08-01T22:30:00Z');
    expect(dueDigest(offen(nachMitternacht), ['r-admin'], nachMitternacht)).toBeNull();
  });

  it('nennt, was an dem Spiel fehlt', () => {
    const digest = dueDigest(offen(abends), ['r-admin'], abends);
    const lines = digest?.payload['lines'] as readonly string[];
    expect(lines[0]).toContain('Schiedsrichter 1 und Schiedsrichter 2 offen');
  });

  it('nennt in jeder Zeile Datum, Uhrzeit und den Vorlauf', () => {
    /*
     * Ohne Datum muesste der Admin nachschlagen, welcher Tag "in 10 Tagen"
     * ist; ohne Vorlauf muesste er nachrechnen, wie eilig es ist.
     */
    const digest = dueDigest(offen(abends), ['r-admin'], abends);
    const lines = digest?.payload['lines'] as readonly string[];
    expect(lines[0]).toContain('Di 11.08.2026, 19:00 Uhr');
    expect(lines[0]).toContain('(in 10 Tagen)');
  });

  it('schweigt, wenn nichts offen ist — eine leere Zusammenfassung kostet nur Geld', () => {
    const voll = input({
      games: [entry({ slots: slotsFrom(['a', 'b', 'c', 'd'], (x) => ({ ...x, confirmedAt: NOW })) })],
      referees: [admin],
    });
    expect(dueDigest(voll, ['r-admin'], abends)).toBeNull();
  });

  it('schweigt, wenn der Admin sie abgeschaltet hat', () => {
    const aus = { ...offen(abends), alerts: { ...DEFAULT_ALERT_SETTINGS, dailyDigest: false } };
    expect(dueDigest(aus, ['r-admin'], abends)).toBeNull();
  });

  it('geht ab der eingestellten Stunde raus, nicht frueher', () => {
    expect(DIGEST_HOUR).toBe(18);
  });
});

describe('Der Gesamtplan bleibt bei doppeltem Lauf derselbe', () => {
  const jk = makeReferee({ id: 'r-jk', reminderHours: [24] });
  const admin = makeReferee({ id: 'r-admin', role: 'admin', name: 'Admin' });

  const voll = (): SchedulerInput =>
    input({
      games: [
        entry({
          game: makeGame({ kickoff: inHours(20) }),
          slots: slotsFrom(['r-jk', null, 'r-tf', null]),
        }),
      ],
      referees: [jk, admin],
    });

  it('liefert bei gleichem Zeitpunkt exakt dieselben Schluessel', () => {
    const a = planNotifications(voll(), NOW);
    const b = planNotifications(voll(), NOW);
    expect(a.intents.map((i) => i.key)).toEqual(b.intents.map((i) => i.key));
  });

  it('vergibt jeden Schluessel innerhalb eines Laufs nur einmal', () => {
    const plan = planNotifications(voll(), NOW);
    expect(new Set(plan.intents.map((i) => i.key)).size).toBe(plan.intents.length);
  });

  it('laesst sich vor dem Versand durchzaehlen — Regel 33', () => {
    const plan = planNotifications(voll(), NOW);
    expect(totalCostUnits(plan.intents)).toBeGreaterThan(0);
    expect(totalCostUnits(plan.intents)).toBe(
      plan.intents.reduce((sum, i) => sum + i.recipientIds.length, 0),
    );
  });

  it('nimmt abgesagte Spiele vollstaendig aus dem Plan', () => {
    const abgesagt = input({
      games: [
        entry({
          game: makeGame({ kickoff: inHours(20), state: 'cancelled' }),
          slots: slotsFrom(['r-jk', null, 'r-tf', null]),
        }),
      ],
      referees: [jk, admin],
    });
    expect(planNotifications(abgesagt, NOW).intents).toEqual([]);
  });
});
