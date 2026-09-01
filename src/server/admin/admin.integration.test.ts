import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../../test/ligen';
import { CSV_COLUMNS } from '@/domain/csv';
import { claimNextSlot } from '../assignments';
import { setPlayedAsReferee } from './appearances';
import { createGame, editGame, importCsv, previewCsv, removeFromGame } from './games';
import { createReferee, setQualification, updateReferee } from './referees';
import { saveSettings, setLeague } from './settings';

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
      leagueId: 'U14',
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

    it('lehnt dasselbe Spiel ein zweites Mal ab, mit Begründung', async () => {
      await newGame();
      const again = await createGame(admin, {
        localDate: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Berlin',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(inDays(30)),
        localTime: '10:30',
        leagueId: 'U14',
        home: `${prefix}-heim`,
        away: `${prefix}-gast`,
        venue: 'Andere Halle',
        requiredLicense: 'E',
      });
      expect(again.ok).toBe(false);
      expect(again.message).toContain('gibt es schon');
    });

    it('verlangt vollständige Angaben', async () => {
      const result = await createGame(admin, {
        localDate: '2026-09-12',
        localTime: '10:30',
        leagueId: 'U14',
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
      overrideWithdraw: false,
      overrideSubstituteRequest: false,
      overrideOneGamePerDay: false,
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
      const result = await editGame(admin, gameId, {
        ...editInput(30, 'Testhalle'),
        overrideWithdraw: true,
      });
      expect(result.message).toBe('Gespeichert.');
      expect((await outbox(gameId)).filter((row) => row.kind === 'relocation')).toHaveLength(0);
    });

    it('setzt die Freigaben, die der Admin pro Spiel erteilt', async () => {
      const gameId = await newGame();
      await editGame(admin, gameId, { ...editInput(30, 'Testhalle'), overrideWithdraw: true });
      const rows = await sql<{ override_withdraw: boolean }[]>`
        SELECT override_withdraw FROM games WHERE id = ${gameId}`;
      expect(rows[0]?.override_withdraw).toBe(true);
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
      const rows = await sql<{ active: boolean }[]>`SELECT active FROM leagues WHERE id = ${league}`;
      expect(rows[0]?.active).toBe(false);
    });
  });

  describe('Spiele nachpflegen', () => {
    it('Regel 27: trägt den Einsatz eines Ersatzes nach', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      await claimNextSlot(gameId, b);
      await claimNextSlot(gameId, c);

      const result = await setPlayedAsReferee(admin, gameId, 2, true);
      expect(result.ok).toBe(true);
      expect(await auditActions(gameId)).toContain('appearance.set');

      const rows = await sql<{ played_as_referee: boolean }[]>`
        SELECT played_as_referee FROM assignments
        WHERE game_id = ${gameId} AND slot_index = 2`;
      expect(rows[0]?.played_as_referee).toBe(true);
    });

    it('lässt sich auch wieder zurücknehmen', async () => {
      const gameId = await newGame();
      await claimNextSlot(gameId, a);
      await claimNextSlot(gameId, b);
      await claimNextSlot(gameId, c);

      await setPlayedAsReferee(admin, gameId, 2, true);
      await setPlayedAsReferee(admin, gameId, 2, false);
      const rows = await sql<{ played_as_referee: boolean }[]>`
        SELECT played_as_referee FROM assignments
        WHERE game_id = ${gameId} AND slot_index = 2`;
      expect(rows[0]?.played_as_referee).toBe(false);
    });

    it('meldet einen leeren Platz', async () => {
      const gameId = await newGame();
      expect(await setPlayedAsReferee(admin, gameId, 3, true)).toMatchObject({ ok: false });
    });
  });
});
