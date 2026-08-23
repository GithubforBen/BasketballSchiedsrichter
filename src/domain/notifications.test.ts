import { describe, expect, it } from 'vitest';
import {
  adminAlertIntent,
  assignmentIntent,
  confirmationRequestIntent,
  dailyDigestIntent,
  costUnits,
  deduplicate,
  openSlotAnnouncementIntent,
  personalReminderIntent,
  promotionOfferIntent,
  relocationIntent,
  totalCostUnits,
} from './notifications';
import type { NotificationIntent, NotificationKind } from './notifications';

/** Der alte Termin, den eine Verschiebungsnachricht mitfuehrt. */
const previous = { kickoff: new Date('2026-09-01T18:00:00Z'), venue: 'Sporthalle Nordstadt' };

describe('Regel 31 — wer sich eintraegt, bekommt eine Bestaetigung', () => {
  it('richtet die Nachricht an genau diese Person', () => {
    const intent = assignmentIntent('g1', 'r-jk', 0);
    expect(intent.kind).toBe('assignment');
    expect(intent.recipientIds).toEqual(['r-jk']);
    expect(intent.expectsReply).toBe(false);
  });
});

describe('Regel 32 — der Admin erinnert alle Qualifizierten an offene Spiele', () => {
  it('nimmt die uebergebene Reihenfolge unveraendert an — sie kommt aus der Rotation', () => {
    const order = ['r-jk', 'r-ms', 'r-nb'];
    expect(openSlotAnnouncementIntent('g1', order, 0, 1).recipientIds).toEqual(order);
  });

  it('zaehlt jede Runde einzeln, damit eine zweite Erinnerung moeglich bleibt', () => {
    expect(openSlotAnnouncementIntent('g1', ['a'], 0, 1).key).not.toBe(
      openSlotAnnouncementIntent('g1', ['a'], 0, 2).key,
    );
  });
});

describe('Regel 33 — jede Nachricht kostet Geld und wird gezaehlt', () => {
  it('zaehlt eine Einheit je Empfaenger', () => {
    expect(costUnits(openSlotAnnouncementIntent('g1', ['a', 'b', 'c'], 0, 1))).toBe(3);
    expect(costUnits(assignmentIntent('g1', 'r-jk', 0))).toBe(1);
  });

  it('summiert ueber alle Absichten', () => {
    const intents = [
      assignmentIntent('g1', 'r-jk', 0),
      openSlotAnnouncementIntent('g2', ['a', 'b'], 0, 1),
      relocationIntent('g3', ['a', 'b', 'c'], 1, previous),
    ];
    expect(totalCostUnits(intents)).toBe(6);
  });
});

describe('Idempotenz — keine Doppelversendung', () => {
  it('filtert Absichten heraus, die schon verschickt wurden', () => {
    const intent = confirmationRequestIntent('g1', 'r-jk', 'initial');
    expect(deduplicate([intent], new Set([intent.key]))).toHaveLength(0);
  });

  it('filtert Dubletten innerhalb derselben Runde', () => {
    const a = personalReminderIntent('g1', 'r-jk', 24);
    const b = personalReminderIntent('g1', 'r-jk', 24);
    expect(deduplicate([a, b], new Set())).toHaveLength(1);
  });

  it('unterscheidet Erstanfrage und Nachfassen', () => {
    const first = confirmationRequestIntent('g1', 'r-jk', 'initial');
    const second = confirmationRequestIntent('g1', 'r-jk', 'follow-up');
    expect(deduplicate([first, second], new Set())).toHaveLength(2);
  });

  it('unterscheidet Nachrueck-Anfragen an ihrer Anfrage, nicht an Spiel und Platz', () => {
    const keys = new Set([
      promotionOfferIntent('o1', 'g1', 'r-tf', 0, new Date()).key,
      promotionOfferIntent('o2', 'g1', 'r-ay', 0, new Date()).key,
      promotionOfferIntent('o3', 'g2', 'r-tf', 0, new Date()).key,
    ]);
    expect(keys.size).toBe(3);
  });

  it('fragt dieselbe Person in einer zweiten Runde erneut — die Anfrage ist eine andere', () => {
    const first = promotionOfferIntent('o1', 'g1', 'r-tf', 0, new Date());
    const second = promotionOfferIntent('o2', 'g1', 'r-tf', 0, new Date());
    expect(deduplicate([first, second], new Set())).toHaveLength(2);
  });

  it('verschickt dieselbe Verschiebung nicht zweimal, eine spaetere aber schon', () => {
    const v1 = relocationIntent('g1', ['a', 'b'], 1, previous);
    const v2 = relocationIntent('g1', ['a', 'b'], 2, previous);
    expect(deduplicate([v1, v1, v2], new Set())).toHaveLength(2);
  });
});


describe('Jede Nachricht ist idempotent und zaehlbar — Review-Checkliste', () => {
  const previousTerm = { kickoff: new Date('2026-09-01T18:00:00Z'), venue: 'Halle' };

  /**
   * Eine Absicht je Art. Kommt eine neue Art dazu, faellt sie hier auf, weil
   * die Liste gegen den Typ geprueft wird.
   */
  const oneOfEach: Readonly<Record<Exclude<NotificationKind, 'login'>, NotificationIntent>> = {
    assignment: assignmentIntent('g1', 'r-jk', 0),
    'confirmation-request': confirmationRequestIntent('g1', 'r-jk', 'initial'),
    'confirmation-follow-up': confirmationRequestIntent('g1', 'r-jk', 'follow-up'),
    'promotion-offer': promotionOfferIntent('o1', 'g1', 'r-tf', 0, new Date()),
    'open-slot-announcement': openSlotAnnouncementIntent('g1', ['a', 'b'], 0, 0),
    relocation: relocationIntent('g1', ['a'], 1, previousTerm),
    'personal-reminder': personalReminderIntent('g1', 'r-jk', 24),
    'admin-alert': adminAlertIntent('g1', ['r-admin'], 'confirmation-overdue', 'r-jk', 'Text'),
    'daily-digest': dailyDigestIntent(['r-admin'], '2026-08-01', ['Zeile']),
  };

  it('traegt fuer jede Art einen Schluessel', () => {
    for (const [kind, intent] of Object.entries(oneOfEach)) {
      expect(intent.key, kind).not.toBe('');
      expect(intent.kind, kind).toBe(kind);
    }
  });

  it('vergibt zwischen den Arten keinen Schluessel doppelt', () => {
    const keys = Object.values(oneOfEach).map((intent) => intent.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('laesst jede Art zweimal erzeugen, ohne dass zwei Nachrichten daraus werden', () => {
    for (const intent of Object.values(oneOfEach)) {
      expect(deduplicate([intent, intent], new Set()), intent.kind).toHaveLength(1);
    }
  });

  it('zaehlt jede Art in Nachrichteneinheiten — Regel 33', () => {
    for (const intent of Object.values(oneOfEach)) {
      expect(costUnits(intent), intent.kind).toBe(intent.recipientIds.length);
    }
  });
});
