import { describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_SETTINGS } from './alerts';
import {
  DIGEST_HOUR,
  NUDGE_LEAD_DAYS,
  dueAdminOpenSlots,
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
import { totalCostUnits, type NotificationIntent } from './notifications';
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
  openSlots: [],
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
      refereeMap(makeReferee({ id: 'r-jk', name: 'Jonas Keller', firstName: 'Jonas' })),
      NOW,
    );
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.recipientIds).toEqual(['r-admin']);
    /*
     * Nur der Anlass, ohne Spielbezeichnung: die Vorlage nennt das Spiel in
     * einer eigenen Variablen und liest es beim Versand frisch.
     */
    expect(String(alerts[0]?.payload['detail'])).toContain('Jonas');
    expect(String(alerts[0]?.payload['detail'])).not.toContain('BG Nordstadt');
  });

  it('meldet zwei offene Bestaetigungen als zwei Meldungen, nicht als eine', () => {
    const alerts = dueConfirmationAlerts(
      withReferees(inHours(40)),
      settings(),
      DEFAULT_ALERT_SETTINGS,
      ['r-admin'],
      refereeMap(),
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

  it('schickt bei "nur Admins" gar keine Einzelnachricht — dafuer gibt es die Bilanz', () => {
    /*
     * Zehn Luecken ergaben frueher zehn gleichlautende Aufrufe an dieselben
     * Admins. Sie bekommen die Sache jetzt einmal am Abend als Bilanz; die
     * Einzelausschreibung bleibt den Qualifizierten vorbehalten.
     */
    const admin = makeReferee({ id: 'r-admin', role: 'admin', qualifications: ['U18'] });
    const intent = openSlotAnnouncement(
      entry({ game: makeGame({ kickoff: inDays(20) }), slots: gap }),
      [jk, admin],
      new Map(),
      settings({ openSlotVisibility: 'admins' }),
      NOW,
    );
    expect(intent).toBeNull();
  });

  it('laesst aus, wem die Lizenz fuer dieses Spiel fehlt', () => {
    /*
     * Eine Ausschreibung an jemanden, der sich anschliessend nicht eintragen
     * darf, kostet Geld (Regel 33) und stiftet Verwirrung.
     */
    const mitE = makeReferee({ id: 'r-e', qualifications: ['U14'], license: 'E' });
    const ohne = makeReferee({ id: 'r-o', qualifications: ['U14'], license: null });
    const intent = openSlotAnnouncement(
      entry({
        game: makeGame({ kickoff: inDays(20), requiredLicense: 'D' }),
        slots: gap,
      }),
      [jk, mitE, ohne],
      new Map(),
      settings(),
      NOW,
    );
    expect(intent?.recipientIds).toEqual(['r-jk']);
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

  const first = (intents: readonly NotificationIntent[]): NotificationIntent | undefined =>
    intents[0];

  it('geht erst ab der eingestellten Ortszeit raus', () => {
    expect(dueDigest(offen(morgens), [admin], morgens)).toHaveLength(0);
    expect(dueDigest(offen(abends), [admin], abends)).toHaveLength(1);
  });

  it('traegt den Kalendertag in Vereinszeit im Schluessel', () => {
    expect(first(dueDigest(offen(abends), [admin], abends))?.key).toBe('digest:2026-08-01');
  });

  it('richtet sich nach der Ortszeit, nicht nach UTC', () => {
    /*
     * Kurz nach Mitternacht Ortszeit ist der Abend vorbei. In UTC waere es
     * noch der Vortag um 22:30 und damit scheinbar "abends" — die Nachricht
     * ginge zur falschen Tageszeit raus.
     */
    const nachMitternacht = new Date('2026-08-01T22:30:00Z');
    expect(dueDigest(offen(nachMitternacht), [admin], nachMitternacht)).toHaveLength(0);
  });

  it('nennt, was an dem Spiel fehlt', () => {
    const lines = first(dueDigest(offen(abends), [admin], abends))?.payload['lines'] as
      | readonly string[]
      | undefined;
    expect(lines?.[0]).toContain('Schiedsrichter 1 und Schiedsrichter 2 offen');
  });

  it('nennt in jeder Zeile Datum, Uhrzeit und den Vorlauf', () => {
    /*
     * Ohne Datum muesste der Admin nachschlagen, welcher Tag "in 10 Tagen"
     * ist; ohne Vorlauf muesste er nachrechnen, wie eilig es ist.
     */
    const lines = first(dueDigest(offen(abends), [admin], abends))?.payload['lines'] as
      | readonly string[]
      | undefined;
    expect(lines?.[0]).toContain('Di 11.08.2026, 19:00 Uhr');
    expect(lines?.[0]).toContain('(in 10 Tagen)');
  });

  it('schweigt, wenn nichts offen ist — eine leere Zusammenfassung kostet nur Geld', () => {
    const voll = input({
      games: [entry({ slots: slotsFrom(['a', 'b', 'c', 'd'], (x) => ({ ...x, confirmedAt: NOW })) })],
      referees: [admin],
    });
    expect(dueDigest(voll, [admin], abends)).toHaveLength(0);
  });

  it('schweigt, wenn der Verein sie abgeschaltet hat', () => {
    const aus = { ...offen(abends), alerts: { ...DEFAULT_ALERT_SETTINGS, dailyDigest: false } };
    expect(dueDigest(aus, [admin], abends)).toHaveLength(0);
  });

  it('schweigt fuer den Admin, der sie in seinem Profil abgeschaltet hat', () => {
    const stumm = makeReferee({ id: 'r-admin', role: 'admin', digestEnabled: false });
    expect(dueDigest(offen(abends), [stumm], abends)).toHaveLength(0);
  });

  it('haelt sich an den Zeitraum aus dem Profil', () => {
    /*
     * Der eine Admin plant vier Wochen voraus, der andere kuemmert sich nur um
     * das kommende Wochenende. Beide bekommen dieselbe Nachricht mit
     * unterschiedlichem Inhalt — dasselbe Spiel in zehn Tagen steht nur bei
     * dem einen drin.
     */
    const weit = makeReferee({ id: 'r-weit', role: 'admin', digestWeeks: 4 });
    const nah = makeReferee({ id: 'r-nah', role: 'admin', digestWeeks: 1 });
    const stand = input({
      games: [entry({ game: makeGame({ kickoff: inDays(10, abends) }) })],
      referees: [weit, nah],
    });

    const intents = dueDigest(stand, [weit, nah], abends);
    expect(intents.map((i) => i.recipientIds[0])).toEqual(['r-weit']);
  });

  it('schickt jedem Admin seine eigene Nachricht', () => {
    const a = makeReferee({ id: 'r-a', role: 'admin' });
    const b = makeReferee({ id: 'r-b', role: 'admin' });
    const intents = dueDigest(
      input({
        games: [entry({ game: makeGame({ kickoff: inDays(10, abends) }) })],
        referees: [a, b],
      }),
      [a, b],
      abends,
    );
    expect(intents).toHaveLength(2);
    expect(intents.every((i) => i.recipientIds.length === 1)).toBe(true);
  });

  it('geht ab der eingestellten Stunde raus, nicht frueher', () => {
    expect(DIGEST_HOUR).toBe(18);
  });
});

describe('Regeln 15 und 32 — die Tagesbilanz der offenen Plaetze', () => {
  const abends = new Date('2026-08-01T17:00:00Z'); // 19 Uhr Ortszeit
  const morgens = new Date('2026-08-01T06:00:00Z');
  const admin = makeReferee({ id: 'r-admin', role: 'admin' });

  const stand = (now: Date): SchedulerInput =>
    input({
      referees: [admin],
      settings: settings({ openSlotVisibility: 'admins' }),
      openSlots: [
        { kickoff: inDays(3, now), missingReferees: 1 },
        { kickoff: inDays(5, now), missingReferees: 2 },
        { kickoff: inDays(9, now), missingReferees: 0 },
        { kickoff: inDays(12, now), missingReferees: 2 },
      ],
    });

  it('zaehlt Luecken und ganz unbesetzte Spiele getrennt', () => {
    const intent = dueAdminOpenSlots(stand(abends), ['r-admin'], abends);
    expect(intent?.payload['gamesWithGap']).toBe(3);
    expect(intent?.payload['gamesWithoutAny']).toBe(2);
  });

  it('nennt das zeitlich naechste Spiel mit Luecke', () => {
    const intent = dueAdminOpenSlots(stand(abends), ['r-admin'], abends);
    expect(intent?.payload['nextKickoff']).toBe(inDays(3, abends).toISOString());
  });

  it('geht hoechstens einmal am Tag raus', () => {
    const intent = dueAdminOpenSlots(stand(abends), ['r-admin'], abends);
    expect(intent?.key).toBe('open-slots-admin:2026-08-01');
  });

  it('wartet auf den Abend — eine Bilanz um drei Uhr nachts weckt nur', () => {
    expect(dueAdminOpenSlots(stand(morgens), ['r-admin'], morgens)).toBeNull();
  });

  it('schweigt, solange an alle Qualifizierten ausgeschrieben wird', () => {
    const anAlle = { ...stand(abends), settings: settings({ openSlotVisibility: 'all' }) };
    expect(dueAdminOpenSlots(anAlle, ['r-admin'], abends)).toBeNull();
  });

  it('schweigt, wenn keine Luecke offen ist', () => {
    const voll = {
      ...stand(abends),
      openSlots: [{ kickoff: inDays(3, abends), missingReferees: 0 }],
    };
    expect(dueAdminOpenSlots(voll, ['r-admin'], abends)).toBeNull();
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
