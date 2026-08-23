import { describe, expect, it } from 'vitest';
import { inHours, makeGame, NOW, settings, slotsFrom } from './__fixtures__/build';
import { confirmationDueAt, confirmationState } from './confirmation';
import {
  commitReminder,
  evaluateReminder,
  reminderTimes,
  remindersLabel,
  removeReminder,
  sortReminders,
  REMINDER_PRESETS,
} from './reminders';

describe('Regel 21 — Erinnerungen zwischen 1 Stunde und 7 Tagen', () => {
  it('nimmt einen Zeitpunkt innerhalb des Bereichs an', () => {
    expect(evaluateReminder([], 36, settings())).toMatchObject({ kind: 'added' });
  });

  it('nimmt die beiden Raender an', () => {
    expect(evaluateReminder([], 1, settings()).kind).toBe('added');
    expect(evaluateReminder([], 168, settings()).kind).toBe('added');
  });

  it('lehnt alles ausserhalb ab', () => {
    expect(evaluateReminder([], 0, settings()).kind).toBe('out-of-range');
    expect(evaluateReminder([], 169, settings()).kind).toBe('out-of-range');
    expect(evaluateReminder([], -5, settings()).kind).toBe('out-of-range');
  });

  it('lehnt Bruchteile von Stunden ab', () => {
    expect(evaluateReminder([], 1.5, settings()).kind).toBe('out-of-range');
  });

  it('bietet die Schnellauswahl aus dem Mockup an', () => {
    expect(REMINDER_PRESETS).toEqual([168, 72, 48, 24, 3, 1]);
    for (const preset of REMINDER_PRESETS) {
      expect(evaluateReminder([], preset, settings()).kind).toBe('added');
    }
  });

  it('lehnt eine bereits gesetzte Erinnerung ab', () => {
    expect(evaluateReminder([48], 48, settings()).kind).toBe('duplicate');
  });
});

describe('Regel 22 — Kostenrueckfrage ab der vierten Erinnerung', () => {
  it('fragt bei den ersten drei nicht nach', () => {
    expect(evaluateReminder([], 1, settings()).kind).toBe('added');
    expect(evaluateReminder([168], 1, settings()).kind).toBe('added');
    expect(evaluateReminder([168, 72], 1, settings()).kind).toBe('added');
  });

  it('fragt bei der vierten nach', () => {
    const result = evaluateReminder([168, 72, 48], 1, settings());
    expect(result).toMatchObject({ kind: 'needs-cost-confirmation', current: 3 });
    if (result.kind === 'needs-cost-confirmation') {
      expect(result.message).toContain('kostet den Verein Geld');
    }
  });

  it('fragt auch bei jeder weiteren nach', () => {
    expect(evaluateReminder([168, 72, 48, 24], 1, settings()).kind).toBe(
      'needs-cost-confirmation',
    );
  });

  it('folgt der eingestellten Schwelle', () => {
    const early = settings({ reminderCostWarningFrom: 2 });
    expect(evaluateReminder([168], 1, early).kind).toBe('needs-cost-confirmation');
  });

  it('legt die Erinnerung nach bestaetigter Rueckfrage an', () => {
    const result = commitReminder([168, 72, 48], 1, settings());
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.reminders).toEqual([168, 72, 48, 1]);
  });
});

describe('Regel 23 — Hard-Limit bei zehn Erinnerungen', () => {
  const nine = [168, 120, 96, 72, 48, 36, 24, 12, 6];
  const ten = [...nine, 3];

  it('erlaubt die zehnte', () => {
    expect(evaluateReminder(nine, 1, settings()).kind).toBe('needs-cost-confirmation');
  });

  it('lehnt die elfte ab', () => {
    const result = evaluateReminder(ten, 1, settings());
    expect(result.kind).toBe('limit-reached');
    if (result.kind === 'limit-reached') expect(result.message).toContain('10');
  });

  it('laesst sich auch mit bestaetigter Rueckfrage nicht umgehen', () => {
    expect(commitReminder(ten, 1, settings())).toMatchObject({ ok: false });
  });

  it('zaehlt das Limit gegen den eingestellten Wert', () => {
    expect(evaluateReminder([168, 72], 1, settings({ reminderLimit: 2 })).kind).toBe(
      'limit-reached',
    );
  });

  it('zeigt den Verbrauch an', () => {
    expect(remindersLabel([168, 72], settings())).toBe('2 von 10 genutzt');
  });
});

describe('Verwalten der Liste', () => {
  it('sortiert vom fruehesten Vorlauf zum spaetesten', () => {
    expect(sortReminders([3, 168, 24])).toEqual([168, 24, 3]);
  });

  it('entfernt eine Erinnerung', () => {
    expect(removeReminder([168, 72, 3], 72)).toEqual([168, 3]);
  });

  it('rechnet die Sendezeitpunkte aus dem Anpfiff zurueck', () => {
    const kickoff = new Date('2026-09-12T10:30:00Z');
    expect(reminderTimes(kickoff, [24, 1])).toEqual([
      new Date('2026-09-11T10:30:00Z'),
      new Date('2026-09-12T09:30:00Z'),
    ]);
  });
});

describe('Regel 24 — die Pflichtbestaetigung kommt zusaetzlich und zaehlt nicht mit', () => {
  const full = [168, 120, 96, 72, 48, 36, 24, 12, 6, 3];

  it('bleibt bei voller persoenlicher Liste unangetastet', () => {
    // Auch am Hard-Limit wird die Pflichtbestaetigung ganz normal angefordert:
    // sie laeuft ueber einen eigenen Mechanismus und kennt die Liste nicht.
    const game = makeGame({ kickoff: inHours(72) });
    const slots = slotsFrom(['r-jk', 'r-lb', null, null]);
    const slot = slots[0];
    expect(slot).toBeDefined();
    expect(full).toHaveLength(settings().reminderLimit);
    if (slot) expect(confirmationState(slot, game, settings(), NOW)).toBe('pending');
  });

  it('kommt auch ohne jede persoenliche Erinnerung', () => {
    // Wer alle eigenen Erinnerungen entfernt, bekommt trotzdem die
    // Pflichtbestaetigung — sie wird nicht aus der Liste gespeist.
    const game = makeGame({ kickoff: inHours(72) });
    const slots = slotsFrom(['r-jk', null, null, null]);
    const slot = slots[0];
    expect(reminderTimes(game.kickoff, [])).toHaveLength(0);
    if (slot) expect(confirmationState(slot, game, settings(), NOW)).toBe('pending');
  });

  it('faellt mit einer persoenlichen Erinnerung zusammen, ohne sie zu ersetzen', () => {
    // 72 Stunden Vorlauf gibt es in beiden Systemen. Das ist zulaessig: es sind
    // zwei getrennte Nachrichten. Beim Versand in M5 ist genau das der Fall,
    // in dem zwei Nachrichten gleichzeitig faellig werden und beide Geld kosten.
    const kickoff = new Date('2026-09-12T10:30:00Z');
    const confirmationTime = confirmationDueAt(makeGame({ kickoff }), settings());
    const personal = reminderTimes(kickoff, [72]).map((d) => d.getTime());
    expect(personal).toContain(confirmationTime.getTime());
  });

  it('zaehlt nur persoenliche Erinnerungen gegen das Limit', () => {
    expect(remindersLabel(full, settings())).toBe('10 von 10 genutzt');
  });
});
