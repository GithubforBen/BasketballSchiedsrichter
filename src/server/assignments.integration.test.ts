import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { License } from '@/domain/types';
import { ensureLeagues } from '../../test/ligen';
import {
  claimNextSlot,
  confirmAssignment,
  requestSubstitute,
  respondToPromotion,
  respondToRelocation,
  withdraw,
} from './assignments';

/**
 * Die Besetzung eines Spiels gegen eine echte Datenbank.
 *
 * Der wichtigste Fall steht ganz oben: zwei Personen tragen sich im selben
 * Moment ein. Genau eine gewinnt, die andere bekommt eine verständliche
 * Meldung — nicht eine Fehlerseite und nicht stillschweigend nichts.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Besetzung', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `slot-test-${randomUUID().slice(0, 8)}`;
  const gameId = `${prefix}-g`;
  const a = `${prefix}-a`;
  const b = `${prefix}-b`;
  const c = `${prefix}-c`;
  const unqualified = `${prefix}-u`;
  /** Qualifiziert, aber ohne Lizenz — der Fall, der nichts pfeifen darf. */
  const unlicensed = `${prefix}-n`;
  /** Qualifiziert mit der niedrigeren Lizenz E. */
  const lowLicense = `${prefix}-e`;

  /**
   * Anpfiff in `n` Tagen, immer um 10:00 Ortszeit.
   *
   * Die Tageszeit gehoert festgelegt: mit der aktuellen Uhrzeit als Anker
   * faellt ein Spiel „drei Stunden spaeter“ am Abend auf den Folgetag, und ein
   * Test zu Regel 6 waere je nach Uhrzeit des Laufs mal erfolgreich, mal nicht.
   */
  const inDays = (n: number, hour = 10) => {
    const day = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(day);
    // Europe/Berlin liegt ein bis zwei Stunden vor UTC; 10:00 Ortszeit liegt
    // damit sicher am selben Kalendertag wie 13:00 Ortszeit.
    const naive = new Date(`${local}T${String(hour).padStart(2, '0')}:00:00Z`);
    const offset =
      new Date(naive.toLocaleString('en-US', { timeZone: 'Europe/Berlin' })).getTime() -
      new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    return new Date(naive.getTime() - offset);
  };

  /** `license` ist bewusst ein Parameter — geprueft wird auch der Fall ohne. */
  const makeReferee = async (
    id: string,
    initials: string,
    leagues: readonly string[],
    license: License | null = 'D',
  ) => {
    await sql`INSERT INTO referees (id, name, first_name, license, initials, phone)
              VALUES (${id}, ${`Person ${initials}`}, 'Person', ${license}, ${initials},
                      ${`+4915${Math.floor(Math.random() * 900000000 + 100000000)}`})`;
    for (const league of leagues) {
      await sql`INSERT INTO qualifications (referee_id, league_id) VALUES (${id}, ${league})`;
    }
  };

  const makeGame = async (id: string, kickoff: Date, league = 'U14') => {
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
              VALUES (${id}, ${kickoff}, ${league}, 'Heim', 'Gast', 'Halle')`;
  };

  /** Schaltet die Quittung nach dem Eintragen um (Vorlage 2). */
  const setReceipt = async (on: boolean) => {
    await sql`INSERT INTO settings (id, assignment_receipt) VALUES (1, ${on})
              ON CONFLICT (id) DO UPDATE SET assignment_receipt = ${on}`;
  };

  const occupants = async (id = gameId) => {
    const rows = await sql<{ slot_index: number; referee_id: string }[]>`
      SELECT slot_index, referee_id FROM assignments WHERE game_id = ${id}
      ORDER BY slot_index`;
    return rows.map((row) => `${row.slot_index}:${row.referee_id.replace(`${prefix}-`, '')}`);
  };

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 10 });
    await ensureLeagues(sql);
    await makeReferee(a, `X${prefix.slice(-3)}A`, ['U14', 'U16']);
    await makeReferee(b, `X${prefix.slice(-3)}B`, ['U14', 'U16']);
    await makeReferee(c, `X${prefix.slice(-3)}C`, ['U14', 'U16']);
    await makeReferee(unqualified, `X${prefix.slice(-3)}U`, ['U18']);
    await makeReferee(unlicensed, `X${prefix.slice(-3)}N`, ['U14', 'U16'], null);
    await makeReferee(lowLicense, `X${prefix.slice(-3)}E`, ['U14', 'U16'], 'E');
  });

  afterEach(async () => {
    await sql`DELETE FROM games WHERE id LIKE ${`${prefix}%`}`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM games WHERE id LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM referees WHERE id LIKE ${`${prefix}%`}`;
    await sql.end();
  });

  it('Regel 3: zwei gleichzeitige Eintragungen — genau eine gewinnt den Platz', async () => {
    await makeGame(gameId, inDays(30));

    const [first, second] = await Promise.all([
      claimNextSlot(gameId, a),
      claimNextSlot(gameId, b),
    ]);

    // Beide dürfen erfolgreich sein — sie landen dann auf Platz 0 und 1.
    // Entscheidend ist, dass niemand denselben Platz doppelt belegt.
    const rows = await occupants();
    expect(new Set(rows.map((r) => r.split(':')[0])).size).toBe(rows.length);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    for (const result of [first, second]) {
      expect(result.message.length).toBeGreaterThan(10);
    }
  });

  it('Regel 3: vier gleichzeitige Eintragungen auf ein leeres Spiel füllen es genau einmal', async () => {
    await makeGame(gameId, inDays(30));

    const results = await Promise.all([
      claimNextSlot(gameId, a),
      claimNextSlot(gameId, b),
      claimNextSlot(gameId, c),
      claimNextSlot(gameId, a),
    ]);

    const rows = await occupants();
    // Kein Platz doppelt, keine Person doppelt.
    expect(new Set(rows.map((r) => r.split(':')[0])).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.split(':')[1])).size).toBe(rows.length);
    expect(rows.length).toBeLessThanOrEqual(3);

    // Jede Antwort erklärt sich, auch die abgelehnten.
    for (const result of results) {
      expect(result.message.length, JSON.stringify(result)).toBeGreaterThan(10);
    }
  });

  it('Regel 2: füllt die Plätze der Reihe nach', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await claimNextSlot(gameId, b);
    await claimNextSlot(gameId, c);
    expect((await occupants()).map((r) => r.split(':')[0])).toEqual(['0', '1', '2']);
  });

  it('ohne Lizenz geht nichts, auch mit Qualifikation', async () => {
    /*
     * Die Lizenz steht neben der Qualifikation, nicht an ihrer Stelle: diese
     * Person darf die Liga, aber hat gar keine Lizenz — und damit kein Spiel.
     * Sehen darf sie den Spielplan trotzdem; das prueft die Oberflaeche.
     */
    await makeGame(gameId, inDays(30));
    const result = await claimNextSlot(gameId, unlicensed);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Lizenz');
  });

  it('die niedrigere Lizenz reicht nicht für ein Spiel, das die höhere verlangt', async () => {
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue, required_license)
              VALUES (${gameId}, ${inDays(30)}, 'U14', 'Heim', 'Gast', 'Halle', 'D')`;
    const result = await claimNextSlot(gameId, lowLicense);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Lizenz D');
  });

  it('die höhere Lizenz deckt das Spiel mit der niedrigeren ab', async () => {
    await makeGame(gameId, inDays(30));
    expect((await claimNextSlot(gameId, lowLicense)).ok).toBe(true);
  });

  it('Regel 4: ohne Qualifikation geht nichts, mit Begründung', async () => {
    await makeGame(gameId, inDays(30));
    const result = await claimNextSlot(gameId, unqualified);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Qualifikation');
    expect(await occupants()).toHaveLength(0);
  });

  it('Regel 5: dieselbe Person kann keinen zweiten Platz belegen', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    const second = await claimNextSlot(gameId, a);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('schon');
    expect(await occupants()).toHaveLength(1);
  });

  it('Regel 6: kein zweites Spiel am selben Tag, mit Begründung', async () => {
    // Beide Spiele liegen sicher am selben Kalendertag: 10:00 und 13:00 Ortszeit.
    await makeGame(gameId, inDays(30, 10));
    await makeGame(`${prefix}-g2`, inDays(30, 13));

    await claimNextSlot(gameId, a);
    const second = await claimNextSlot(`${prefix}-g2`, a);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('an diesem Tag');
  });

  it('Regel 6: erlaubt ein Spiel am Vortag', async () => {
    await makeGame(gameId, inDays(30, 10));
    await makeGame(`${prefix}-g2`, inDays(29, 18));

    await claimNextSlot(gameId, a);
    expect((await claimNextSlot(`${prefix}-g2`, a)).ok).toBe(true);
  });

  it('Regel 7: Austragen gibt den Platz wieder frei', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    const result = await withdraw(gameId, a);
    expect(result.ok).toBe(true);
    expect(await occupants()).toHaveLength(0);
  });

  it('Regel 7: nach der Frist gesperrt, mit Begründung', async () => {
    await makeGame(gameId, inDays(5));
    await claimNextSlot(gameId, a);
    const result = await withdraw(gameId, a);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Admin');
    expect(await occupants()).toHaveLength(1);
  });

  it('Regel 8: Ersatz anfordern verlangt einen eigenen Platz und einen Ersatz', async () => {
    await makeGame(gameId, inDays(30));

    const outsider = await requestSubstitute(gameId, a);
    expect(outsider.ok).toBe(false);
    expect(outsider.message).toContain('selbst');

    await claimNextSlot(gameId, a);
    const leereBank = await requestSubstitute(gameId, a);
    expect(leereBank.ok).toBe(false);
    expect(leereBank.message).toContain('kein Ersatz');

    await claimNextSlot(gameId, b);
    await claimNextSlot(gameId, c);
    const mitBank = await requestSubstitute(gameId, a);
    expect(mitBank.ok, mitBank.message).toBe(true);
  });

  it('Regel 10: bestätigen setzt den Haken, und nur auf Schiedsrichter-Plätzen', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await claimNextSlot(gameId, b);
    await claimNextSlot(gameId, c);

    expect((await confirmAssignment(gameId, a)).ok).toBe(true);
    // Platz 2 ist ein Ersatzplatz — dort gibt es nichts zu bestätigen.
    const substitute = await confirmAssignment(gameId, c);
    expect(substitute.ok).toBe(false);

    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM assignments
      WHERE game_id = ${gameId} AND confirmed_at IS NOT NULL`;
    expect(rows[0]?.n).toBe(1);
  });

  it('Regel 18: eine Absage nach Verschiebung öffnet den Platz sofort', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await sql`UPDATE games SET state = 'moved', relocation_version = 1 WHERE id = ${gameId}`;

    const declined = await respondToRelocation(gameId, a, 'decline');
    expect(declined.ok).toBe(true);
    expect(await occupants()).toHaveLength(0);
  });

  it('Regel 17: „Bleibe dabei“ quittiert den neuen Termin und lässt den Platz belegt', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await sql`UPDATE games SET state = 'moved', relocation_version = 1 WHERE id = ${gameId}`;

    expect((await respondToRelocation(gameId, a, 'keep')).ok).toBe(true);
    expect(await occupants()).toHaveLength(1);

    const rows = await sql<{ acknowledged_relocation: number }[]>`
      SELECT acknowledged_relocation FROM assignments WHERE game_id = ${gameId}`;
    expect(rows[0]?.acknowledged_relocation).toBe(1);
  });

  it('jede Aktion hinterlässt einen Eintrag im Prüfprotokoll', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await confirmAssignment(gameId, a);
    await withdraw(gameId, a);

    const rows = await sql<{ action: string }[]>`
      SELECT action FROM audit_log WHERE game_id = ${gameId} ORDER BY created_at`;
    expect(rows.map((r) => r.action)).toEqual([
      'assignment.claim',
      'assignment.confirm',
      'assignment.withdraw',
    ]);
  });

  it('Regel 31: eine Eintragung legt eine Zuteilungsnachricht in die Outbox', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    const rows = await sql<{ kind: string; recipient_id: string }[]>`
      SELECT kind, recipient_id FROM notification_outbox WHERE game_id = ${gameId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('assignment');
    expect(rows[0]?.recipient_id).toBe(a);
  });

  it('schweigt bei der Eintragung, wenn der Verein die Quittung abgeschaltet hat', async () => {
    await setReceipt(false);
    try {
      await makeGame(gameId, inDays(30));
      await claimNextSlot(gameId, a);
      const rows = await sql<{ kind: string }[]>`
        SELECT kind FROM notification_outbox WHERE game_id = ${gameId}`;
      expect(rows).toHaveLength(0);
      // Die Eintragung selbst bleibt davon unberührt.
      expect(await occupants()).toEqual([`0:${a.replace(`${prefix}-`, '')}`]);
    } finally {
      await setReceipt(true);
    }
  });


  describe('Regel 8: das Spiel abgeben — die ganze Kette', () => {
    const offers = async () => {
      const rows = await sql<
        {
          kind: string;
          referee_id: string;
          substitute_slot: number;
          target_slot: number;
          outcome: string;
          replaces_referee_id: string | null;
        }[]
      >`SELECT kind, referee_id, substitute_slot, target_slot, outcome, replaces_referee_id
        FROM promotion_offers WHERE game_id = ${gameId} ORDER BY created_at`;
      return rows.map((row) => ({
        ...row,
        referee_id: row.referee_id.replace(`${prefix}-`, ''),
        replaces_referee_id: row.replaces_referee_id?.replace(`${prefix}-`, '') ?? null,
      }));
    };

    const latestOfferId = async () => {
      const rows = await sql<{ id: string }[]>`
        SELECT id FROM promotion_offers WHERE game_id = ${gameId}
        ORDER BY created_at DESC LIMIT 1`;
      return rows[0]?.id ?? '';
    };

    /** a auf Schiri 1, b auf Schiri 2, c auf Ersatz 1. */
    const besetzt = async () => {
      await makeGame(gameId, inDays(30));
      await claimNextSlot(gameId, a);
      await claimNextSlot(gameId, b);
      await claimNextSlot(gameId, c);
    };

    it('fragt genau einen Ersatz und laesst die Besetzung zunaechst unberuehrt', async () => {
      await besetzt();
      const result = await requestSubstitute(gameId, a);
      expect(result.ok, result.message).toBe(true);

      /*
       * Der Abgebende bleibt auf seinem Platz, bis jemand zusagt. Ein Spiel,
       * das zwischendurch unbesetzt dasteht, waere schlechter als eines mit
       * einem Schiedsrichter, der noch sucht.
       */
      expect(await occupants()).toEqual([`0:a`, `1:b`, `2:c`]);
      expect(await offers()).toEqual([
        {
          kind: 'handover',
          referee_id: 'c',
          substitute_slot: 2,
          target_slot: 0,
          outcome: 'pending',
          replaces_referee_id: 'a',
        },
      ]);
    });

    it('legt genau eine Nachricht in die Outbox — nicht eine an alle', async () => {
      await besetzt();
      await requestSubstitute(gameId, a);
      const rows = await sql<{ recipient_id: string; kind: string }[]>`
        SELECT recipient_id, kind FROM notification_outbox
        WHERE game_id = ${gameId} AND kind = 'promotion-offer'`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.recipient_id).toBe(c);
    });

    it('laesst keine zweite Anfrage zu, solange die erste laeuft', async () => {
      await besetzt();
      await requestSubstitute(gameId, a);
      const zweite = await requestSubstitute(gameId, a);
      expect(zweite.ok).toBe(false);
      expect(zweite.message).toContain('läuft schon');
      expect(await offers()).toHaveLength(1);
    });

    it('tauscht bei Zusage die Plaetze: der Ersatz rueckt auf, der Abgebende ist raus', async () => {
      await besetzt();
      await requestSubstitute(gameId, a);
      const result = await respondToPromotion(await latestOfferId(), c, 'accept');
      expect(result.ok, result.message).toBe(true);

      expect(await occupants()).toEqual([`0:c`, `1:b`]);
    });

    it('setzt beim Uebernehmen die Pflichtbestaetigung zurueck', async () => {
      await besetzt();
      await requestSubstitute(gameId, a);
      await respondToPromotion(await latestOfferId(), c, 'accept');
      const rows = await sql<{ confirmed_at: Date | null }[]>`
        SELECT confirmed_at FROM assignments WHERE game_id = ${gameId} AND referee_id = ${c}`;
      expect(rows[0]?.confirmed_at).toBeNull();
    });

    it('nimmt den Absagenden von der Bank und fragt den naechsten', async () => {
      await besetzt();
      /* b von Schiri 2 runter und auf Ersatz 2, damit die Bank zwei traegt. */
      await sql`UPDATE assignments SET slot_index = 3
                WHERE game_id = ${gameId} AND referee_id = ${b}`;
      await requestSubstitute(gameId, a);

      const result = await respondToPromotion(await latestOfferId(), c, 'decline');
      expect(result.ok, result.message).toBe(true);
      expect(result.message).toContain('raus');

      /*
       * c ist weg, b rueckt von Ersatz 2 auf Ersatz 1 — und wird sofort
       * gefragt. Die Kette laeuft weiter, ohne dass jemand nachhelfen muss.
       */
      expect(await occupants()).toEqual([`0:a`, `2:b`]);
      const alle = await offers();
      expect(alle).toHaveLength(2);
      expect(alle[0]).toMatchObject({ referee_id: 'c', outcome: 'declined' });
      expect(alle[1]).toMatchObject({
        referee_id: 'b',
        substitute_slot: 2,
        outcome: 'pending',
        replaces_referee_id: 'a',
      });
    });

    it('endet, wenn nach der Absage niemand mehr auf der Bank sitzt', async () => {
      await besetzt();
      await requestSubstitute(gameId, a);
      const result = await respondToPromotion(await latestOfferId(), c, 'decline');
      expect(result.ok).toBe(true);
      expect(result.message).toContain('nicht bereit');

      /* Der Abgebende behaelt seinen Platz — er weiss jetzt, dass er dran ist. */
      expect(await occupants()).toEqual([`0:a`, `1:b`]);
      expect(await offers()).toHaveLength(1);
    });

    it('erlaubt dem Admin denselben Vorgang fuer einen geraeumten Platz', async () => {
      await makeGame(gameId, inDays(30));
      await claimNextSlot(gameId, b);
      await claimNextSlot(gameId, c);
      /* Platz 0 bleibt leer — so sieht es aus, wenn der Admin jemanden austrägt. */
      await sql`UPDATE assignments SET slot_index = 2
                WHERE game_id = ${gameId} AND referee_id = ${c}`;
      await sql`UPDATE assignments SET slot_index = 1
                WHERE game_id = ${gameId} AND referee_id = ${b}`;
      await sql`UPDATE referees SET role = 'admin' WHERE id = ${a}`;

      const result = await requestSubstitute(gameId, a);
      expect(result.ok, result.message).toBe(true);

      const alle = await offers();
      expect(alle).toHaveLength(1);
      expect(alle[0]).toMatchObject({
        kind: 'handover',
        referee_id: 'c',
        target_slot: 0,
        /* Niemand raeumt etwas — der Platz war schon leer. */
        replaces_referee_id: null,
      });

      await respondToPromotion(await latestOfferId(), c, 'accept');
      expect(await occupants()).toEqual([`0:c`, `1:b`]);
      await sql`UPDATE referees SET role = 'referee' WHERE id = ${a}`;
    });

    it('erklaert es, wenn der Abgebende inzwischen selbst weg ist', async () => {
      await besetzt();
      await requestSubstitute(gameId, a);
      const offerId = await latestOfferId();
      /* Jemand anderes besetzt Platz 0 — Regel 3, wer zuerst kommt. */
      await sql`DELETE FROM assignments WHERE game_id = ${gameId} AND referee_id = ${a}`;
      await sql`UPDATE assignments SET slot_index = 0
                WHERE game_id = ${gameId} AND referee_id = ${b}`;

      const result = await respondToPromotion(offerId, c, 'accept');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('besetzt');
    });

    it('sperrt die Anfrage nach der Frist und gibt sie mit der Freigabe wieder frei', async () => {
      await makeGame(gameId, inDays(1));
      await claimNextSlot(gameId, a);
      await claimNextSlot(gameId, b);
      await claimNextSlot(gameId, c);

      const gesperrt = await requestSubstitute(gameId, a);
      expect(gesperrt.ok).toBe(false);
      expect(gesperrt.message).toContain('gesperrt');

      await sql`UPDATE games SET override_substitute_request = true WHERE id = ${gameId}`;
      const frei = await requestSubstitute(gameId, a);
      expect(frei.ok, frei.message).toBe(true);
    });
  });

  describe('Regeln 13 bis 16: die Antwort auf eine Nachrück-Anfrage', () => {
    /** Ein Spiel mit freiem Schiedsrichter-Platz und einem Ersatz, plus Anfrage. */
    const withOffer = async (respondBy: Date) => {
      await makeGame(gameId, inDays(30));
      await sql`INSERT INTO assignments (game_id, slot_index, referee_id)
                VALUES (${gameId}, 2, ${b})`;
      const offerId = `${prefix}-offer`;
      await sql`INSERT INTO promotion_offers
                  (id, game_id, target_slot, substitute_slot, referee_id, respond_by)
                VALUES (${offerId}, ${gameId}, 0, 2, ${b}, ${respondBy})`;
      return offerId;
    };

    const outcomeOf = async (offerId: string) => {
      const rows = await sql<{ outcome: string }[]>`
        SELECT outcome FROM promotion_offers WHERE id = ${offerId}`;
      return rows[0]?.outcome;
    };

    afterEach(async () => {
      await sql`DELETE FROM promotion_offers WHERE id LIKE ${`${prefix}%`}`;
    });

    it('rückt die Person vom Ersatz- auf den Schiedsrichter-Platz', async () => {
      const offerId = await withOffer(inDays(1));
      const result = await respondToPromotion(offerId, b, 'accept');
      expect(result.ok).toBe(true);
      expect(await occupants()).toEqual([`0:${b.replace(`${prefix}-`, '')}`]);
      expect(await outcomeOf(offerId)).toBe('accepted');
    });

    it('setzt die Pflichtbestätigung zurück — sie gilt für den neuen Platz', async () => {
      const offerId = await withOffer(inDays(1));
      await sql`UPDATE assignments SET confirmed_at = now()
                WHERE game_id = ${gameId} AND referee_id = ${b}`;
      await respondToPromotion(offerId, b, 'accept');
      const rows = await sql<{ confirmed_at: Date | null }[]>`
        SELECT confirmed_at FROM assignments WHERE game_id = ${gameId} AND referee_id = ${b}`;
      expect(rows[0]?.confirmed_at).toBeNull();
    });

    it('lässt bei einer Absage alles, wie es war', async () => {
      const offerId = await withOffer(inDays(1));
      const result = await respondToPromotion(offerId, b, 'decline');
      expect(result.ok).toBe(true);
      expect(await occupants()).toEqual([`2:${b.replace(`${prefix}-`, '')}`]);
      expect(await outcomeOf(offerId)).toBe('declined');
    });

    it('nimmt keine zweite Antwort auf dieselbe Anfrage an', async () => {
      const offerId = await withOffer(inDays(1));
      await respondToPromotion(offerId, b, 'decline');
      const again = await respondToPromotion(offerId, b, 'accept');
      expect(again.ok).toBe(false);
      expect(again.message).toContain('abgeschlossen');
    });

    it('nimmt nach der Frist nichts mehr an', async () => {
      const offerId = await withOffer(new Date(Date.now() - 1000));
      const result = await respondToPromotion(offerId, b, 'accept');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('verstrichen');
    });

    it('nimmt die Antwort einer anderen Person nicht an', async () => {
      const offerId = await withOffer(inDays(1));
      const result = await respondToPromotion(offerId, c, 'accept');
      expect(result.ok).toBe(false);
    });

    it('erklärt es, wenn der Platz inzwischen besetzt ist — Regel 3', async () => {
      const offerId = await withOffer(inDays(1));
      await claimNextSlot(gameId, a);
      const result = await respondToPromotion(offerId, b, 'accept');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('besetzt');
      expect(await occupants()).toEqual([
        `0:${a.replace(`${prefix}-`, '')}`,
        `2:${b.replace(`${prefix}-`, '')}`,
      ]);
    });
  });
});
