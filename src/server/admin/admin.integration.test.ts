import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../../test/ligen';
import { CSV_COLUMNS } from '@/domain/csv';
import { claimNextSlot } from '../assignments';
import {
  assignReferee,
  createGame,
  editGame,
  importCsv,
  previewCsv,
  removeFromGame,
  setGameReleases,
} from './games';
import {
  createReferee,
  importRefereeCsv,
  previewRefereeCsv,
  setQualification,
  updateReferee,
} from './referees';
import { saveSettings, setLeague } from './settings';
import { loadPasswordOverview } from '../queries/referees';

/**
 * Die Admin-Aktionen gegen eine echte Datenbank.
 *
 * Der Review-Fokus dieses Meilensteins: jede Aktion hinterlaesst einen Eintrag
 * im Pruefprotokoll, das Verschieben erreicht Schiedsrichter **und** Ersatz,
 * und der Import ist wiederholbar.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Adminbereich', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `admin-test-${randomUUID().slice(0, 8)}`;
  const admin = `${prefix}-admin`;
  const a = `${prefix}-a`;
  const b = `${prefix}-b`;
  const c = `${prefix}-c`;

  const header = CSV_COLUMNS.join(';');

  /**
   * Kuerzel im gueltigen Format: zwei bis vier Grossbuchstaben. Die Testdaten
   * muessen dieselbe Regel einhalten wie echte Konten, sonst prueft der Test
   * am Ende nur die Formatpruefung statt dessen, worum es ihm geht.
   */
  const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const initials = () => `${letter()}${letter()}${letter()}`;
  const usedInitials = new Map<string, string>();
  /**
   * Bezugspunkt einmal festgehalten. Wuerde jeder Aufruf die Uhr neu lesen,
   * koennten zwei Aufrufe innerhalb desselben Tests um Mitternacht auf
   * verschiedene Kalendertage fallen.
   */
  const startedAt = Date.now();
  const inDays = (n: number) => new Date(startedAt + n * 24 * 60 * 60 * 1000);
  const germanDate = (date: Date) =>
    new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);

  const makeReferee = async (id: string, code: string, leagues: readonly string[]) => {
    usedInitials.set(id, code);
    await sql`INSERT INTO referees (id, name, first_name, license, initials, phone, role)
              VALUES (${id}, ${`Person ${code}`}, 'Person', 'D', ${code},
                      ${`+4917${Math.floor(Math.random() * 900000000 + 100000000)}`},
                      ${id === admin ? 'admin' : 'referee'})`;
    for (const league of leagues) {
      await sql`INSERT INTO qualifications (referee_id, league_id) VALUES (${id}, ${league})`;
    }
  };

  const auditActions = async (gameId?: string) => {
    const rows = gameId
      ? await sql<{ action: string }[]>`SELECT action FROM audit_log WHERE game_id = ${gameId}
                                        ORDER BY created_at`
      : await sql<{ action: string }[]>`SELECT action FROM audit_log WHERE actor_id = ${admin}
                                        ORDER BY created_at`;
    return rows.map((row) => row.action);
  };

  const outbox = async (gameId: string) =>
    sql<{ kind: string; recipient_id: string }[]>`
      SELECT kind, recipient_id FROM notification_outbox WHERE game_id = ${gameId}`;

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 10 });
    await ensureLeagues(sql);
    for (const [id, leagues] of [
      [admin, ['U14', 'U16']],
      [a, ['U14', 'U16']],
      [b, ['U14', 'U16']],
      [c, ['U14', 'U16']],
    ] as const) {
      let code = initials();
      // Bei drei Buchstaben ist eine Kollision unwahrscheinlich, aber möglich.
      while ([...usedInitials.values()].includes(code)) code = initials();
      await makeReferee(id, code, leagues);
    }
  });

  afterEach(async () => {
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`} OR away LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM audit_log WHERE actor_id = ${admin}`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`} OR away LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM referees WHERE id LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM leagues WHERE id = ${`${prefix}-liga`}`;
    await sql.end();
  });

  const newGame = async (daysAhead = 30) => {
    const result = await createGame(admin, {
      localDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(inDays(daysAhead)),
      localTime: '10:30',
      league: 'U14',
      home: `${prefix}-heim`,
      away: `${prefix}-gast`,
      venue: 'Testhalle',
      requiredLicense: 'E',
    });
    expect(result.ok, result.message).toBe(true);
    return result.ok ? (result.gameId ?? '') : '';
  };

  describe('Spiele anlegen', () => {
    it('legt ein Spiel an und schreibt es ins Prüfprotokoll', async () => {
      const gameId = await newGame();
      expect(await auditActions(gameId)).toEqual(['game.create']);
    });

    it('legt dieselbe Paarung auch ein zweites Mal an — es gibt sie wirklich zweimal', async () => {
      /*
       * Zwei Begegnungen parallel in derselben Halle, jede mit eigenen
       * Schiedsrichtern. Frueher wies die Eindeutigkeitsbedingung der
       * Datenbank das ab und der CSV-Import verlor dabei jede zweite Zeile.
       */
      await newGame();
      const again = await createGame(admin, {
        localDate: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Berlin',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(inDays(30)),
        localTime: '10:30',
        league: 'U14',
        home: `${prefix}-heim`,
        away: `${prefix}-gast`,
        venue: 'Andere Halle',
        requiredLicense: 'E',
      });
      expect(again.ok).toBe(true);
    });

    it('verlangt vollständige Angaben', async () => {
      const result = await createGame(admin, {
        localDate: '2026-09-12',
        localTime: '10:30',
        league: 'U14',
        home: '',
        away: `${prefix}-gast`,
        venue: 'Halle',
        requiredLicense: 'E',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('CSV-Import', () => {
    const csv = (dayOffset: number) =>
      [
        header,
        `${germanDate(inDays(dayOffset))};10:00;U14;${prefix}-heim;${prefix}-gast;Halle`,
        `${germanDate(inDays(dayOffset))};12:00;U16;${prefix}-heim2;${prefix}-gast2;Halle`,
      ].join('\n');

    it('importiert und meldet, was entstanden ist', async () => {
      const result = await importCsv(admin, csv(40));
      expect(result.ok).toBe(true);
      expect(result.message).toContain('2 Spiele importiert');
      expect(await auditActions()).toContain('game.import');
    });

    it('ist wiederholbar: derselbe Import legt nichts doppelt an', async () => {
      await importCsv(admin, csv(41));
      const second = await importCsv(admin, csv(41));
      expect(second.ok).toBe(true);
      expect(second.message).toContain('gibt es schon');

      const rows = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM games WHERE home LIKE ${`${prefix}%`}`;
      expect(rows[0]?.n).toBe(2);
    });

    it('zeigt vor dem Import, was neu ist und was nicht', async () => {
      await importCsv(admin, csv(42));
      const preview = await previewCsv(csv(42));
      expect(preview.fresh).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(2);
    });

    it('meldet eine falsche Kopfzeile, statt etwas anzulegen', async () => {
      const result = await importCsv(admin, 'Datum;Zeit\n01.02.2026;10:00');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('Kopfzeile');
    });

    it('importiert die brauchbaren Zeilen und lässt die anderen liegen', async () => {
      const mixed = [
        header,
        `${germanDate(inDays(43))};10:00;U14;${prefix}-heim;${prefix}-gast;Halle`,
        `31.02.2026;10:00;U14;${prefix}-heim3;${prefix}-gast3;Halle`,
      ].join('\n');
      const result = await importCsv(admin, mixed);
      expect(result.message).toContain('1 Spiele importiert');
      expect(result.message).toContain('1 unbrauchbar');
    });
  });

  describe('Schiedsrichter-Import', () => {
    /*
     * Ein eigener Nummernblock je Testlauf. Telefonnummern sind in der
     * Datenbank eindeutig; zwei gleichzeitige Laeufe duerfen sich nicht in die
     * Quere kommen, und aufgeraeumt wird hinterher genau ueber diesen Block.
     */
    const block = `+49170${Math.floor(Math.random() * 900 + 100)}`;
    const written = (n: number) => `0170 ${block.slice(6)}${String(n).padStart(4, '0')}`;
    const stored = (n: number) => `${block}${String(n).padStart(4, '0')}`;

    const refereeCsv = (...lines: string[]) =>
      ['Name;Vorname;Kürzel;Telefon;Rolle;Lizenz;Ligen', ...lines].join('\n');

    const imported = () =>
      sql<
        {
          name: string;
          initials: string;
          phone: string;
          license: string | null;
          role: string;
          password_hash: string | null;
        }[]
      >`
        SELECT name, initials, phone, license, role, password_hash
        FROM referees WHERE phone LIKE ${`${block}%`} ORDER BY phone`;

    afterEach(async () => {
      await sql`DELETE FROM referees WHERE phone LIKE ${`${block}%`}`;
    });

    it('legt Konten samt Qualifikation und Start-Passwort an', async () => {
      const result = await importRefereeCsv(
        admin,
        refereeCsv(
          `Nina Falk;;${initials()}X;${written(1)};Schiri;D;U14,U16`,
          `Timo Reh;;${initials()}Y;${written(2)};Admin;E;U14`,
        ),
      );
      expect(result.ok, result.message).toBe(true);
      expect(result.message).toContain('2 Schiedsrichter angelegt');

      const rows = await imported();
      expect(rows).toHaveLength(2);
      expect(rows[0]?.phone).toBe(stored(1));
      expect(rows[0]?.license).toBe('D');
      expect(rows[1]?.role).toBe('admin');
      // Ohne Start-Passwort (Regel 35) koennte sich niemand anmelden.
      expect(rows[0]?.password_hash).not.toBeNull();

      const quals = await sql<{ league_id: string }[]>`
        SELECT q.league_id FROM qualifications q
        JOIN referees r ON r.id = q.referee_id
        WHERE r.phone = ${stored(1)} ORDER BY q.league_id`;
      expect(quals.map((row) => row.league_id)).toEqual(['U14', 'U16']);

      expect(await auditActions()).toContain('referee.import');
    });

    it('ist wiederholbar: derselbe Lauf legt niemanden doppelt an', async () => {
      const csv = refereeCsv(`Nina Falk;;${initials()}Z;${written(3)};Schiri;D;U14`);
      await importRefereeCsv(admin, csv);
      const second = await importRefereeCsv(admin, csv);
      expect(second.ok).toBe(true);
      expect(second.message).toContain('gibt es schon');
      expect(await imported()).toHaveLength(1);
    });

    it('erkennt dieselbe Nummer in anderer Schreibweise', async () => {
      await importRefereeCsv(admin, refereeCsv(`Nina Falk;;${initials()}Q;${written(4)};;D;U14`));
      const preview = await previewRefereeCsv(
        refereeCsv(`Nina Falk;;${initials()}R;${stored(4)};;D;U14`),
      );
      expect(preview.fresh).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(1);
    });

    it('weist ein vergebenes Kürzel aus, statt es still zu übergehen', async () => {
      const code = usedInitials.get(a) ?? '';
      const preview = await previewRefereeCsv(
        refereeCsv(`Nina Falk;;${code};${written(5)};;D;U14`),
      );
      expect(preview.fresh).toHaveLength(0);
      expect(preview.conflicts).toHaveLength(1);
    });

    it('meldet eine fehlende Pflichtspalte, statt jemanden anzulegen', async () => {
      // Die Reihenfolge ist frei, die Nummer aber unverzichtbar.
      const result = await importRefereeCsv(admin, `Kürzel;Name\nZZ;Nina Falk`);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('Telefon');
      expect(await imported()).toHaveLength(0);
    });

    it('nimmt die Spalten in beliebiger Reihenfolge', async () => {
      const result = await importRefereeCsv(
        admin,
        `Telefon;Ligen;Name\n${written(8)};U14;Nina Falk`,
      );
      expect(result.ok, result.message).toBe(true);
      const rows = await imported();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.phone).toBe(stored(8));
    });

    it('legt die brauchbaren Zeilen an und lässt die anderen liegen', async () => {
      const result = await importRefereeCsv(
        admin,
        refereeCsv(
          `Nina Falk;;${initials()}M;${written(6)};Schiri;D;U14`,
          `Timo Reh;;${initials()}N;${written(7)};Schiri;D;U99`,
        ),
      );
      expect(result.message).toContain('1 Schiedsrichter angelegt');
      expect(result.message).toContain('1 unbrauchbar');
      expect(await imported()).toHaveLength(1);
    });
  });

  describe('Spiel bearbeiten', () => {
    const editInput = (daysAhead: number, venue: string) => ({
      localDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(inDays(daysAhead)),
      localTime: '10:30',
      venue,
      requiredLicense: 'E' as const,
      reason: 'moved' as const,
    });

    it('Regel 17: benachrichtigt beim Verschieben Schiedsrichter und Ersatz', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      await claimNextSlot(gameId, b);
      await claimNextSlot(gameId, c);

      const result = await editGame(admin, gameId, editInput(35, 'Testhalle'));
      expect(result.ok).toBe(true);
      expect(result.message).toContain('3 Beteiligte');

      const messages = await outbox(gameId);
      const relocation = messages.filter((row) => row.kind === 'relocation');
      // Auch der Ersatz auf Platz 2 ist dabei.
      expect(relocation.map((row) => row.recipient_id).sort()).toEqual([a, b, c].sort());
    });

    it('stellt die Rückfrage bei jeder neuen Verschiebung erneut', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);

      await editGame(admin, gameId, editInput(35, 'Testhalle'));
      await editGame(admin, gameId, editInput(36, 'Testhalle'));

      const rows = await sql<{ relocation_version: number }[]>`
        SELECT relocation_version FROM games WHERE id = ${gameId}`;
      expect(rows[0]?.relocation_version).toBe(2);
      // Zwei verschiedene Nachrichten, nicht eine doppelt.
      expect((await outbox(gameId)).filter((row) => row.kind === 'relocation')).toHaveLength(2);
    });

    it('verschickt nichts, wenn sich weder Termin noch Ort ändern', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      const result = await editGame(admin, gameId, editInput(30, 'Testhalle'));
      expect(result.message).toBe('Gespeichert.');
      expect((await outbox(gameId)).filter((row) => row.kind === 'relocation')).toHaveLength(0);
    });

    it('sagt ein Spiel ab und informiert die Beteiligten', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      const result = await editGame(admin, gameId, {
        ...editInput(30, 'Testhalle'),
        requiredLicense: 'E',
        reason: 'cancelled',
      });
      expect(result.message).toContain('abgesagt');
      expect(await auditActions(gameId)).toContain('game.cancel');
    });
  });

  describe('Freigaben pro Spiel', () => {
    const releases = async (gameId: string) =>
      (
        await sql<
          {
            override_withdraw: boolean;
            override_substitute_request: boolean;
            override_one_game_per_day: boolean;
            state: string;
            relocation_version: number;
            kickoff: Date;
          }[]
        >`SELECT override_withdraw, override_substitute_request, override_one_game_per_day,
                 state, relocation_version, kickoff FROM games WHERE id = ${gameId}`
      )[0];

    it('hebt die Sperre für Ersatz anfordern auf — Regel 8', async () => {
      const gameId = await newGame();
      const result = await setGameReleases(admin, gameId, {
        withdraw: false,
        substituteRequest: true,
        oneGamePerDay: false,
      });
      expect(result.ok).toBe(true);
      expect((await releases(gameId))?.override_substitute_request).toBe(true);
    });

    it('nennt in der Rückmeldung, was jetzt gilt — der Haken allein ist kein Beleg', async () => {
      const gameId = await newGame();
      const result = await setGameReleases(admin, gameId, {
        withdraw: false,
        substituteRequest: true,
        oneGamePerDay: false,
      });
      expect(result.message).toContain('Ersatz anfordern');
      expect(result.message).toContain('niemand benachrichtigt');
    });

    it('laesst das zweite Spiel am Tag unangetastet, wenn die Regel aus ist', async () => {
      /*
       * Ist "ein Spiel pro Tag" abgeschaltet, steht der Haken nicht im
       * Formular und kommt als `null` an. Wer dann nur die Austragefrist
       * freigibt, darf die gespeicherte Ausnahme nicht nebenbei loeschen —
       * sie gilt wieder, sobald der Verein die Regel einschaltet.
       */
      const gameId = await newGame();
      await setGameReleases(admin, gameId, {
        withdraw: false,
        substituteRequest: false,
        oneGamePerDay: true,
      });
      const result = await setGameReleases(admin, gameId, {
        withdraw: true,
        substituteRequest: false,
        oneGamePerDay: null,
      });
      const row = await releases(gameId);
      expect(row?.override_withdraw).toBe(true);
      expect(row?.override_one_game_per_day).toBe(true);
      /* Die Rueckmeldung nennt nur, was ueber das Formular gesetzt wurde. */
      expect(result.message).toContain('Austragen');
      expect(result.message).not.toContain('zweites Spiel');
    });

    it('nimmt eine Freigabe auch wieder zurück', async () => {
      const gameId = await newGame();
      const alle = { withdraw: true, substituteRequest: true, oneGamePerDay: true };
      await setGameReleases(admin, gameId, alle);
      const result = await setGameReleases(admin, gameId, {
        withdraw: false,
        substituteRequest: false,
        oneGamePerDay: false,
      });
      expect(result.message).toContain('wieder alle Fristen');
      const row = await releases(gameId);
      expect([
        row?.override_withdraw,
        row?.override_substitute_request,
        row?.override_one_game_per_day,
      ]).toEqual([false, false, false]);
    });

    it('verschiebt das Spiel nicht und schickt niemandem etwas — Regeln 17 und 33', async () => {
      /*
       * Der eigentliche Grund für die getrennte Operation: über `editGame`
       * ging derselbe Haken nur zusammen mit Datum, Uhrzeit und Ort raus.
       * Wich der gespeicherte Anpfiff um Sekunden vom Formular ab — die
       * Spalte kennt Sekunden, das Eingabefeld nicht —, galt das Spiel als
       * verschoben und jeder Beteiligte bekam eine Nachricht.
       */
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      const vorher = await releases(gameId);
      const vorherigeNachrichten = (await outbox(gameId)).length;

      await setGameReleases(admin, gameId, {
        withdraw: false,
        substituteRequest: true,
        oneGamePerDay: false,
      });

      const nachher = await releases(gameId);
      expect(nachher?.state).toBe(vorher?.state);
      expect(nachher?.relocation_version).toBe(vorher?.relocation_version);
      expect(nachher?.kickoff.getTime()).toBe(vorher?.kickoff.getTime());
      expect(await outbox(gameId)).toHaveLength(vorherigeNachrichten);
    });

    it('schreibt die Freigaben ins Prüfprotokoll', async () => {
      const gameId = await newGame();
      await setGameReleases(admin, gameId, {
        withdraw: true,
        substituteRequest: false,
        oneGamePerDay: false,
      });
      expect(await auditActions(gameId)).toContain('game.releases');
    });

    it('meldet ein Spiel, das es nicht mehr gibt', async () => {
      const result = await setGameReleases(admin, 'gibt-es-nicht', {
        withdraw: true,
        substituteRequest: true,
        oneGamePerDay: true,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('Schiedsrichter einteilen', () => {
    it('setzt eine qualifizierte Person auf einen freien Platz und meldet es ihr', async () => {
      const game = await newGame();
      const result = await assignReferee(admin, game, 1, a);
      expect(result.ok, result.message).toBe(true);

      const rows = await sql<{ referee_id: string }[]>`
        SELECT referee_id FROM assignments WHERE game_id = ${game} AND slot_index = 1`;
      expect(rows[0]?.referee_id).toBe(a);
      expect(await auditActions(game)).toContain('assignment.byAdmin');

      // Ohne Nachricht wuesste die Person nichts von ihrem Einsatz.
      const messages = await outbox(game);
      expect(messages.some((m) => m.kind === 'assignment' && m.recipient_id === a)).toBe(true);
    });

    it('darf die Reihenfolge der Plätze überspringen', async () => {
      // Regel 2 gilt der Selbstbedienung. Wer einteilt, sieht die Besetzung.
      const game = await newGame();
      expect((await assignReferee(admin, game, 3, a)).ok).toBe(true);
    });

    it('lehnt ab, wem die Qualifikation fehlt', async () => {
      const game = await newGame();
      const outsider = `${prefix}-fremd`;
      await makeReferee(outsider, 'QQ', []);
      const result = await assignReferee(admin, game, 0, outsider);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('Qualifikation');
      await sql`DELETE FROM referees WHERE id = ${outsider}`;
    });

    it('lehnt einen belegten Platz ab', async () => {
      const game = await newGame();
      await assignReferee(admin, game, 0, a);
      const result = await assignReferee(admin, game, 0, b);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('belegt');
    });

    it('lehnt einen zweiten Platz für dieselbe Person ab', async () => {
      // Regel 5: niemand belegt zwei Plaetze im selben Spiel.
      const game = await newGame();
      await assignReferee(admin, game, 0, a);
      const result = await assignReferee(admin, game, 1, a);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('schon auf einem anderen Platz');
    });
  });

  describe('Besetzung entfernen', () => {
    it('Regel 13: auf einem Schiedsrichter-Platz wird zuerst der Ersatz gefragt', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      await claimNextSlot(gameId, b);
      await claimNextSlot(gameId, c);

      const result = await removeFromGame(admin, gameId, 0);
      expect(result.ok).toBe(true);
      expect(result.message).toContain('nachrückt');
      expect(await auditActions(gameId)).toContain('assignment.remove');
    });

    it('ohne Ersatz wird der Platz ausgeschrieben', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      await claimNextSlot(gameId, b);

      const result = await removeFromGame(admin, gameId, 0);
      expect(result.message).toContain('ausgeschrieben');
    });

    it('meldet einen leeren Platz, statt stillschweigend nichts zu tun', async () => {
      const gameId = await newGame();
      expect(await removeFromGame(admin, gameId, 3)).toMatchObject({ ok: false });
    });
  });

  describe('Schiedsrichter-Verwaltung', () => {
    it('legt ein Konto an und protokolliert es', async () => {
      let code = initials();
      while ([...usedInitials.values()].includes(code)) code = initials();

      const result = await createReferee(admin, {
        name: `${prefix} Neu`,
        initials: code,
        phone: '0151 55500011',
        firstName: 'Test',
        license: 'E',
        role: 'referee',
      });
      expect(result.ok, result.message).toBe(true);
      expect(await auditActions()).toContain('referee.create');

      await sql`DELETE FROM referees WHERE initials = ${code}`;
    });

    it('vergibt die Qualifikationen gleich beim Anlegen', async () => {
      /*
       * Die neue Zeile in der Tabelle traegt die Liga-Haekchen. Ohne
       * Qualifikation kann sich niemand eintragen (Regel 4) — sie erst in
       * einem zweiten Arbeitsgang zu vergeben, hiesse: manchmal vergessen.
       */
      let code = initials();
      while ([...usedInitials.values()].includes(code)) code = initials();

      const result = await createReferee(admin, {
        name: `${prefix} Qualifiziert`,
        initials: code,
        phone: '0151 55500013',
        firstName: 'Test',
        license: 'D',
        role: 'referee',
        leagueIds: ['U14', 'U16', 'gibtesnicht'],
      });
      expect(result.ok, result.message).toBe(true);

      const rows = await sql<{ league_id: string }[]>`
        SELECT q.league_id FROM qualifications q
        JOIN referees r ON r.id = q.referee_id
        WHERE r.initials = ${code} ORDER BY q.league_id`;
      // Die unbekannte Liga faellt weg, statt das Anlegen scheitern zu lassen.
      expect(rows.map((row) => row.league_id)).toEqual(['U14', 'U16']);

      await sql`DELETE FROM referees WHERE initials = ${code}`;
    });

    it('lehnt ein belegtes Kürzel ab', async () => {
      const result = await createReferee(admin, {
        name: 'Doppelt',
        initials: usedInitials.get(a) ?? '',
        phone: '0151 55500012',
        firstName: 'Test',
        license: 'E',
        role: 'referee',
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('vergeben');
    });

    it('prüft die Form des Kürzels und der Telefonnummer', async () => {
      expect(
        (
          await createReferee(admin, {
            name: 'X',
            firstName: 'X',
            initials: 'j',
            phone: '0151 1234567',
            role: 'referee',
            license: 'E',
          })
        ).ok,
      ).toBe(false);
      expect(
        (
          await createReferee(admin, {
            name: 'X',
            firstName: 'X',
            initials: 'XY',
            phone: 'Telefon',
            role: 'referee',
            license: 'E',
          })
        ).ok,
      ).toBe(false);
    });

    /*
     * Der Fall, der die ganze Umstellung ausgeloest hat: eine importierte
     * Vereinsliste liess in `name` nur den Nachnamen stehen. Das Start-Passwort
     * folgt nach Regel 35 aus dem Namen — es hiess damit auch nur so, und die
     * Tabelle zeigte es genauso an. Beides passte zusammen und war trotzdem
     * falsch.
     *
     * Jetzt laesst sich der Name aendern. Dabei muessen zwei Rechnungen
     * mitgehen, die denselben Namen benutzen: der gespeicherte Hash und die
     * Anzeige daneben. Gingen sie auseinander, stuende in der Tabelle ein
     * Passwort, mit dem sich niemand anmelden kann — der schlimmste Ausgang,
     * weil er wie ein funktionierender Zustand aussieht.
     */
    it('setzt beim Umbenennen das Start-Passwort neu', async () => {
      const code = 'UM';
      const created = await createReferee(admin, {
        name: 'Nachnamensky',
        firstName: 'Vorname',
        initials: code,
        phone: '0151 55500021',
        role: 'referee',
        license: 'E',
      });
      expect(created.ok, created.message).toBe(true);

      const before = await sql<{ id: string; password_hash: string }[]>`
        SELECT id, password_hash FROM referees WHERE initials = ${code}`;
      const id = before[0]?.id ?? '';

      const result = await updateReferee(admin, id, {
        name: 'Vorname Nachnamensky',
        firstName: 'Vorname',
        initials: code,
        phone: '0151 55500021',
        role: 'referee',
        license: 'E',
        active: true,
      });
      expect(result.ok, result.message).toBe(true);
      expect(result.message).toContain('Start-Passwort');

      const after = await sql<{ name: string; password_hash: string }[]>`
        SELECT name, password_hash FROM referees WHERE initials = ${code}`;
      expect(after[0]?.name).toBe('Vorname Nachnamensky');
      // Ein neuer Hash — der alte gehoerte zu "nachnamensky".
      expect(after[0]?.password_hash).not.toBe(before[0]?.password_hash);

      // Und die Anzeige rechnet aus demselben Namen: beide sagen dasselbe.
      const overview = await loadPasswordOverview();
      expect(overview.find((entry) => entry.refereeId === id)?.startPassword).toBe(
        'vornamenachnamensky',
      );

      await sql`DELETE FROM referees WHERE initials = ${code}`;
    });

    it('lässt das Start-Passwort in Ruhe, wenn der Name gleich bleibt', async () => {
      const code = 'UN';
      await createReferee(admin, {
        name: 'Bleibt Gleich',
        firstName: 'Bleibt',
        initials: code,
        phone: '0151 55500022',
        role: 'referee',
        license: 'E',
      });
      const before = await sql<{ id: string; password_hash: string }[]>`
        SELECT id, password_hash FROM referees WHERE initials = ${code}`;

      const result = await updateReferee(admin, before[0]?.id ?? '', {
        name: 'Bleibt Gleich',
        firstName: 'Bleibt',
        initials: code,
        phone: '0151 55500022',
        role: 'referee',
        license: 'D',
        active: true,
      });
      expect(result.ok, result.message).toBe(true);
      expect(result.message).toBe('Gespeichert.');

      const after = await sql<{ password_hash: string }[]>`
        SELECT password_hash FROM referees WHERE initials = ${code}`;
      expect(after[0]?.password_hash).toBe(before[0]?.password_hash);

      await sql`DELETE FROM referees WHERE initials = ${code}`;
    });

    it('Regel 4: erteilt und entzieht Qualifikationen', async () => {
      expect((await setQualification(admin, a, 'U18', true)).ok).toBe(true);
      let rows = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM qualifications
        WHERE referee_id = ${a} AND league_id = 'U18'`;
      expect(rows[0]?.n).toBe(1);

      expect((await setQualification(admin, a, 'U18', false)).ok).toBe(true);
      rows = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM qualifications
        WHERE referee_id = ${a} AND league_id = 'U18'`;
      expect(rows[0]?.n).toBe(0);
    });

    it('schützt den letzten aktiven Admin', async () => {
      // Ohne diese Sperre könnte sich der letzte Admin selbst herabstufen und
      // niemand käme mehr an die Verwaltung — Konten legt nur ein Admin an.
      const rows = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM referees WHERE role = 'admin' AND active = true`;
      const onlyOne = (rows[0]?.n ?? 0) <= 1;

      const result = await updateReferee(admin, admin, {
        name: 'Admin Konto',
        firstName: 'Admin',
        license: 'D' as const,
        initials: usedInitials.get(admin) ?? '',
        phone: '0151 55500099',
        role: 'referee',
        active: true,
      });
      if (onlyOne) {
        expect(result.ok).toBe(false);
        expect(result.message).toContain('letzte aktive Admin');
      } else {
        // Es gibt weitere Admins — dann ist die Änderung erlaubt.
        expect(result.ok).toBe(true);
        await updateReferee(admin, admin, {
          name: 'Admin Konto',
          firstName: 'Admin',
          license: 'D' as const,
          initials: usedInitials.get(admin) ?? '',
          phone: '0151 55500099',
          role: 'admin',
          active: true,
        });
      }
    });

    it('erteilt eine bestehende Qualifikation ohne Fehler noch einmal', async () => {
      await setQualification(admin, a, 'U18', true);
      expect((await setQualification(admin, a, 'U18', true)).ok).toBe(true);
      await setQualification(admin, a, 'U18', false);
    });
  });

  describe('Einstellungen', () => {
    const base = {
      withdrawDeadlineDays: 21,
      substituteRequestDeadlineDays: 3,
      confirmationLeadHours: 72,
      reminderLimit: 10,
      oneGamePerDay: true,
      rotation: true,
      rotationWindow: 'week' as const,
      autoNudge: true,
      openSlotVisibility: 'all' as const,
      assignmentReceipt: true,
      alertUnfilled: true,
      alertConfirmationOverdue: true,
      alertSubstituteMissing: true,
      alertCancellation: true,
      alertDailyDigest: true,
      alertAfterImport: false,
    };

    it('speichert und protokolliert', async () => {
      const result = await saveSettings(admin, { ...base, withdrawDeadlineDays: 14 });
      expect(result.ok).toBe(true);
      const rows = await sql<{ withdraw_deadline_days: number }[]>`
        SELECT withdraw_deadline_days FROM settings WHERE id = 1`;
      expect(rows[0]?.withdraw_deadline_days).toBe(14);
      await saveSettings(admin, base);
    });

    it('lehnt unsinnige Werte ab, mit Begründung', async () => {
      const tooLong = await saveSettings(admin, { ...base, withdrawDeadlineDays: 400 });
      expect(tooLong.ok).toBe(false);
      expect(tooLong.message).toContain('Austragefrist');

      const oddLead = await saveSettings(admin, { ...base, confirmationLeadHours: 37 });
      expect(oddLead.ok).toBe(false);
      expect(oddLead.message).toContain('24, 48, 72 oder 96');
    });

    it('speichert die beiden Nachrichten-Schalter', async () => {
      const result = await saveSettings(admin, {
        ...base,
        openSlotVisibility: 'admins',
        assignmentReceipt: false,
      });
      expect(result.ok).toBe(true);
      const rows = await sql<{ open_slot_visibility: string; assignment_receipt: boolean }[]>`
        SELECT open_slot_visibility, assignment_receipt FROM settings WHERE id = 1`;
      expect(rows[0]?.open_slot_visibility).toBe('admins');
      expect(rows[0]?.assignment_receipt).toBe(false);
      await saveSettings(admin, base);
    });

    it('legt eine Liga an und schaltet sie ab', async () => {
      const league = `${prefix}-liga`;
      expect((await setLeague(admin, league, true)).ok).toBe(true);
      expect((await setLeague(admin, league, false)).ok).toBe(true);
      const rows = await sql<
        { active: boolean }[]
      >`SELECT active FROM leagues WHERE id = ${league}`;
      expect(rows[0]?.active).toBe(false);
    });
  });

  describe('Vergangene Spiele bleiben aenderbar', () => {
    /*
     * "Spiele nachpflegen" ist weg. Gezaehlt wird, wer zum Anpfiff auf Schiri
     * 1 oder Schiri 2 steht — und wenn das ausnahmsweise nicht stimmt, aendert
     * der Admin die Besetzung des vergangenen Spiels. Das muss also gehen.
     */
    const pastGame = async () => {
      const gameId = `${prefix}-past-${randomUUID().slice(0, 8)}`;
      const kickoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
                VALUES (${gameId}, ${kickoff}, 'U14', 'Heim', 'Gast', 'Halle')`;
      return gameId;
    };

    it('teilt auch nach dem Anpfiff noch jemanden ein', async () => {
      const gameId = await pastGame();
      const result = await assignReferee(admin, gameId, 0, a);
      expect(result.ok, result.message).toBe(true);

      const rows = await sql<{ referee_id: string }[]>`
        SELECT referee_id FROM assignments WHERE game_id = ${gameId} AND slot_index = 0`;
      expect(rows[0]?.referee_id).toBe(a);
    });

    it('nimmt auch nach dem Anpfiff jemanden wieder heraus', async () => {
      const gameId = await pastGame();
      await assignReferee(admin, gameId, 0, a);
      const result = await removeFromGame(admin, gameId, 0);
      expect(result.ok, result.message).toBe(true);

      const rows = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM assignments WHERE game_id = ${gameId}`;
      expect(rows[0]?.n).toBe(0);
    });
  });
});
