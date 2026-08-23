import { describe, expect, it } from 'vitest';
import {
  assignmentIntent,
  confirmationRequestIntent,
  costUnits,
  deduplicate,
  openSlotAnnouncementIntent,
  personalReminderIntent,
  promotionOfferIntent,
  relocationIntent,
  totalCostUnits,
} from './notifications';

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
    expect(openSlotAnnouncementIntent('g1', order, 1).recipientIds).toEqual(order);
  });

  it('zaehlt jede Runde einzeln, damit eine zweite Erinnerung moeglich bleibt', () => {
    expect(openSlotAnnouncementIntent('g1', ['a'], 1).key).not.toBe(
      openSlotAnnouncementIntent('g1', ['a'], 2).key,
    );
  });
});

describe('Regel 33 — jede Nachricht kostet Geld und wird gezaehlt', () => {
  it('zaehlt eine Einheit je Empfaenger', () => {
    expect(costUnits(openSlotAnnouncementIntent('g1', ['a', 'b', 'c'], 1))).toBe(3);
    expect(costUnits(assignmentIntent('g1', 'r-jk', 0))).toBe(1);
  });

  it('summiert ueber alle Absichten', () => {
    const intents = [
      assignmentIntent('g1', 'r-jk', 0),
      openSlotAnnouncementIntent('g2', ['a', 'b'], 1),
      relocationIntent('g3', ['a', 'b', 'c'], 1),
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

  it('unterscheidet Nachrueck-Anfragen nach Platz und Person', () => {
    const keys = new Set([
      promotionOfferIntent('g1', 'r-tf', 2).key,
      promotionOfferIntent('g1', 'r-ay', 3).key,
      promotionOfferIntent('g2', 'r-tf', 2).key,
    ]);
    expect(keys.size).toBe(3);
  });

  it('verschickt dieselbe Verschiebung nicht zweimal, eine spaetere aber schon', () => {
    const v1 = relocationIntent('g1', ['a', 'b'], 1);
    const v2 = relocationIntent('g1', ['a', 'b'], 2);
    expect(deduplicate([v1, v1, v2], new Set())).toHaveLength(2);
  });
});
