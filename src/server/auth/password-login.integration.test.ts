import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { START_PASSWORD_VALID_DAYS } from '@/domain/password';
import {
  applyStartPassword,
  changeOwnPassword,
  loginWithPassword,
  resetPasswordByAdmin,
} from './password-login';

/**
 * Die Passwort-Anmeldung gegen eine echte Datenbank. Regeln 34-40.
 *
 * Die reinen Funktionen sichern zu, wie gerechnet wird. Hier steht, was nur mit
 * einer Datenbank zu pruefen ist: dass wirklich nie ein Klartext in einer Spalte
 * landet, dass die Frist aus Regel 36 den Zugang tatsaechlich schliesst und dass
 * ein Zuruecksetzen den Zwang aus Regel 37 wieder herstellt.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const days = (count: number): number => count * 24 * 60 * 60 * 1000;

suite('Anmeldung mit Passwort', () => {
  let sql: ReturnType<typeof postgres>;

  const phone = '+4915900000042';
  const refereeId = `pw-test-${randomUUID()}`;
  const adminId = `pw-admin-${randomUUID()}`;
  const name = 'Friedrich Merz';
  const start = 'friedrichmerz';
  const ip = '203.0.113.42';

  const NOW = new Date('2026-03-01T10:00:00Z');

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await sql`INSERT INTO referees (id, name, initials, phone, role)
              VALUES (${refereeId}, ${name}, ${`P${refereeId.slice(-3)}`}, ${phone}, 'referee')`;
    await sql`INSERT INTO referees (id, name, initials, phone, role)
              VALUES (${adminId}, 'Nele Baumann', ${`A${adminId.slice(-3)}`}, '+4915900000043', 'admin')`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM referees WHERE id IN (${refereeId}, ${adminId})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
    await sql.end();
  });

  beforeEach(async () => {
    await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
    await sql`DELETE FROM audit_log WHERE subject_id = ${refereeId}`;
    await applyStartPassword(refereeId, name, NOW);
  });

  const stored = async (): Promise<{ hash: string; ownSetAt: Date | null; expires: Date | null }> => {
    const rows = await sql`SELECT password_hash, own_password_set_at, start_password_expires_at
                           FROM referees WHERE id = ${refereeId}`;
    const row = rows[0];
    return {
      hash: String(row?.password_hash ?? ''),
      ownSetAt: (row?.own_password_set_at as Date | null) ?? null,
      expires: (row?.start_password_expires_at as Date | null) ?? null,
    };
  };

  describe('Regel 34 — Telefonnummer und Passwort', () => {
    it('lässt mit dem Start-Passwort herein', async () => {
      const result = await loginWithPassword({ phone, password: start, ip }, NOW);
      expect(result.ok).toBe(true);
      expect(result.ok && result.refereeId).toBe(refereeId);
    });

    it('nimmt die Nummer in jeder Schreibweise an — Regel 42', async () => {
      for (const written of ['0159 00000042', '+49 159 00000042', '004915900000042', '0159/00000042']) {
        const result = await loginWithPassword({ phone: written, password: start, ip }, NOW);
        expect(result.ok, `"${written}" wurde abgelehnt`).toBe(true);
      }
    });

    it('lehnt ein falsches Passwort ab', async () => {
      const result = await loginWithPassword({ phone, password: 'friedrichmerx', ip }, NOW);
      expect(result.ok).toBe(false);
    });

    it('antwortet auf eine unbekannte Nummer genauso wie auf ein falsches Passwort', async () => {
      const unknown = await loginWithPassword(
        { phone: '+4915900000099', password: start, ip },
        NOW,
      );
      const wrong = await loginWithPassword({ phone, password: 'falsch', ip }, NOW);
      expect(unknown.ok).toBe(false);
      expect(wrong.ok).toBe(false);
      // Sonst waere die Anmeldeseite ein Verzeichnis, mit dem sich pruefen
      // laesst, wer im Verein pfeift.
      expect(unknown.ok === false && unknown.message).toBe(wrong.ok === false && wrong.message);
    });

    it('lässt ein stillgelegtes Konto nicht herein', async () => {
      await sql`UPDATE referees SET active = false WHERE id = ${refereeId}`;
      const result = await loginWithPassword({ phone, password: start, ip }, NOW);
      await sql`UPDATE referees SET active = true WHERE id = ${refereeId}`;
      expect(result.ok).toBe(false);
    });
  });

  describe('Regel 39 — gespeichert wird nur der Hash', () => {
    it('legt das Passwort nirgends im Klartext ab', async () => {
      await changeOwnPassword(refereeId, start, 'mein hund heißt bello', 'mein hund heißt bello', NOW);

      const row = await sql`SELECT * FROM referees WHERE id = ${refereeId}`;
      const dump = JSON.stringify(row[0]);
      expect(dump).not.toContain('mein hund');
      expect(dump).not.toContain(start);
    });

    it('schreibt auch ins Prüfprotokoll kein Passwort', async () => {
      await resetPasswordByAdmin(adminId, refereeId, NOW);
      const rows = await sql`SELECT detail FROM audit_log WHERE subject_id = ${refereeId}`;
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain(start);
    });
  });

  describe('Regel 36 — die Frist schließt den Zugang', () => {
    it('lässt innerhalb der Frist herein', async () => {
      const kurzVorSchluss = new Date(NOW.getTime() + days(START_PASSWORD_VALID_DAYS) - 1000);
      expect((await loginWithPassword({ phone, password: start, ip }, kurzVorSchluss)).ok).toBe(true);
    });

    it('lässt danach niemanden mehr herein — auch nicht mit dem richtigen Passwort', async () => {
      const zuSpaet = new Date(NOW.getTime() + days(START_PASSWORD_VALID_DAYS + 1));
      const result = await loginWithPassword({ phone, password: start, ip }, zuSpaet);
      expect(result.ok).toBe(false);
    });

    it('nimmt die Frist weg, sobald ein eigenes Passwort steht', async () => {
      await changeOwnPassword(refereeId, start, 'eigenes', 'eigenes', NOW);
      const spaeter = new Date(NOW.getTime() + days(365));
      expect((await loginWithPassword({ phone, password: 'eigenes', ip }, spaeter)).ok).toBe(true);
      expect((await stored()).expires).toBeNull();
    });
  });

  describe('Regel 37 — der Wechsel ist Pflicht', () => {
    it('meldet nach dem Start-Passwort den Zwang', async () => {
      const result = await loginWithPassword({ phone, password: start, ip }, NOW);
      expect(result.ok && result.mustChangePassword).toBe(true);
    });

    it('meldet ihn nicht mehr, sobald ein eigenes Passwort steht', async () => {
      await changeOwnPassword(refereeId, start, 'eigenes', 'eigenes', NOW);
      const result = await loginWithPassword({ phone, password: 'eigenes', ip }, NOW);
      expect(result.ok && result.mustChangePassword).toBe(false);
    });

    it('verlangt beim Wechsel das bisherige Passwort', async () => {
      const result = await changeOwnPassword(refereeId, 'geraten', 'neu', 'neu', NOW);
      expect(result.ok).toBe(false);
      // Das alte muss weiter gelten, sonst haette der Fehlversuch etwas verstellt.
      expect((await loginWithPassword({ phone, password: start, ip }, NOW)).ok).toBe(true);
    });

    it('lässt dasselbe Passwort nicht noch einmal setzen — sonst wäre der Zwang folgenlos', async () => {
      const result = await changeOwnPassword(refereeId, start, start, start, NOW);
      expect(result.ok).toBe(false);
      expect((await stored()).ownSetAt).toBeNull();
    });
  });

  describe('Regel 40 — der Admin setzt zurück', () => {
    it('führt zurück auf das Start-Passwort, mit neuer Frist und neuem Zwang', async () => {
      await changeOwnPassword(refereeId, start, 'eigenes', 'eigenes', NOW);

      const spaeter = new Date(NOW.getTime() + days(200));
      const reset = await resetPasswordByAdmin(adminId, refereeId, spaeter);
      expect(reset.ok).toBe(true);
      expect(reset.startPassword).toBe(start);

      const alt = await loginWithPassword({ phone, password: 'eigenes', ip }, spaeter);
      expect(alt.ok, 'das alte Passwort gilt weiter').toBe(false);

      const neu = await loginWithPassword({ phone, password: start, ip }, spaeter);
      expect(neu.ok).toBe(true);
      expect(neu.ok && neu.mustChangePassword).toBe(true);

      const row = await stored();
      expect(row.ownSetAt).toBeNull();
      expect(row.expires?.getTime()).toBe(spaeter.getTime() + days(START_PASSWORD_VALID_DAYS));
    });

    it('hält den Vorgang im Prüfprotokoll fest', async () => {
      await resetPasswordByAdmin(adminId, refereeId, NOW);
      const rows = await sql`SELECT actor_id, action FROM audit_log
                             WHERE subject_id = ${refereeId} AND action = 'referee.password-reset'`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.actor_id).toBe(adminId);
    });
  });

  describe('Ein enges Limit auf Fehlversuche', () => {
    it('sperrt die Nummer nach wenigen falschen Passwörtern', async () => {
      // Regel 35 macht das Start-Passwort erratbar — im Verein kennt jeder
      // jeden. Dagegen hilft nur, dass das Durchprobieren schnell endet.
      let blocked = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const result = await loginWithPassword({ phone, password: `versuch${attempt}`, ip }, NOW);
        if (result.ok === false && result.message.includes('Zu viele Fehlversuche')) blocked = true;
      }
      expect(blocked).toBe(true);

      // Und zwar auch für das richtige Passwort — sonst brächte die Sperre nichts.
      const echt = await loginWithPassword({ phone, password: start, ip }, NOW);
      expect(echt.ok).toBe(false);
    });

    it('zählt nur Fehlversuche, nicht jede Anmeldung', async () => {
      // Wer sich an einem Abend mehrfach anmeldet, darf sich nicht selbst
      // aussperren — gezählt wird, wer rät.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const result = await loginWithPassword({ phone, password: start, ip }, NOW);
        expect(result.ok, `Anmeldung ${attempt + 1} wurde abgewiesen`).toBe(true);
      }
    });
  });
});
