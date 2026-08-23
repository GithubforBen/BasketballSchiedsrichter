import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { redeemCode, redeemLink, requestLogin } from './login';
import { maskPhone } from './phone';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Der Anmeldevorgang gegen eine echte Datenbank.
 *
 * Hier wird geprueft, was die reinen Funktionen allein nicht zusichern koennen:
 * dass ein Token wirklich nur einmal einloest, dass Rate-Limits ueber Prozesse
 * hinweg zaehlen und dass eine unbekannte Nummer nichts ueber den Bestand
 * verraet.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Anmeldung', () => {
  let sql: ReturnType<typeof postgres>;

  const phone = '+4915900000001';
  const refereeId = `login-test-${randomUUID()}`;

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await sql`INSERT INTO referees (id, name, initials, phone, role)
              VALUES (${refereeId}, 'Test Person', ${`T${refereeId.slice(-3)}`}, ${phone}, 'referee')`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM referees WHERE id = ${refereeId}`;
    await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
    await sql.end();
  });

  beforeEach(async () => {
    await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
    await sql`DELETE FROM login_tokens WHERE referee_id = ${refereeId}`;
    await sql`DELETE FROM notification_outbox WHERE recipient_id = ${refereeId}`;
  });

  const lastMessage = async (): Promise<string> => {
    const rows = await sql`SELECT payload->>'body' AS body FROM notification_outbox
                           WHERE recipient_id = ${refereeId}
                           ORDER BY send_after DESC LIMIT 1`;
    return String(rows[0]?.body ?? '');
  };

  const issue = async (ip = '203.0.113.1') => {
    await requestLogin({ phone, ip });
    const body = await lastMessage();
    const token = /token=([^\s]+)/.exec(body)?.[1];
    const code = /Code ein: (\d{6})/.exec(body)?.[1];
    expect(token, 'kein Link in der Nachricht').toBeDefined();
    expect(code, 'kein Code in der Nachricht').toBeDefined();
    return { token: decodeURIComponent(token ?? ''), code: code ?? '' };
  };

  it('legt Link und Code in dieselbe Nachricht', async () => {
    const { token, code } = await issue();
    expect(token.length).toBeGreaterThan(20);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('meldet mit dem Link an', async () => {
    const { token } = await issue();
    const result = await redeemLink(token);
    expect(result).toMatchObject({ ok: true, refereeId, role: 'referee' });
  });

  it('meldet mit dem Code an', async () => {
    const { code } = await issue();
    expect(await redeemCode({ phone, code })).toMatchObject({ ok: true, refereeId });
  });

  it('lässt denselben Link nur ein einziges Mal gelten', async () => {
    const { token } = await issue();
    expect((await redeemLink(token)).ok).toBe(true);
    expect(await redeemLink(token)).toMatchObject({ ok: false });
  });

  it('entwertet den Code, sobald der Link benutzt wurde', async () => {
    const { token, code } = await issue();
    expect((await redeemLink(token)).ok).toBe(true);
    expect(await redeemCode({ phone, code })).toMatchObject({ ok: false });
  });

  it('gewinnt bei zwei gleichzeitigen Einlösungen nur einmal', async () => {
    const { token } = await issue();
    const results = await Promise.all([redeemLink(token), redeemLink(token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('verrät nicht, ob es eine Nummer gibt', async () => {
    const unknownPhone = '+4915900009999';
    const known = await requestLogin({ phone, ip: '203.0.113.2' });
    const unknown = await requestLogin({ phone: unknownPhone, ip: '203.0.113.3' });

    // Beide Antworten folgen demselben Satz; nur die eigene, verdeckte Nummer
    // steht darin. Aus der Antwort allein ist nicht abzulesen, ob es die
    // Nummer gibt.
    const template = (message: string, forPhone: string) =>
      message.replace(maskPhone(forPhone), '<nummer>');
    expect(template(unknown.message, unknownPhone)).toBe(template(known.message, phone));
    expect(unknown.accepted).toBe(known.accepted);

    // Auch in der Datenbank entsteht für die unbekannte Nummer nichts.
    expect(known.tokenId).toBeDefined();
    expect(unknown.tokenId).toBeUndefined();
    const orphans = await sql`SELECT count(*)::int AS n FROM login_tokens
                              WHERE referee_id NOT IN (SELECT id FROM referees)`;
    expect(orphans[0]?.n).toBe(0);
  });

  it('nennt in der Bestätigung nur die verdeckte Nummer', async () => {
    const result = await requestLogin({ phone, ip: '203.0.113.4' });
    expect(result.message).not.toContain('00000001');
    expect(result.message).toContain('•••');
  });

  it('begrenzt Anforderungen je Telefonnummer', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await requestLogin({ phone, ip: `203.0.113.${10 + attempt}` });
      expect(result.accepted, `Versuch ${attempt + 1}`).toBe(true);
    }
    const blocked = await requestLogin({ phone, ip: '203.0.113.20' });
    expect(blocked.accepted).toBe(false);
    expect(blocked.message).toContain('Telefonnummer');
  });

  it('zählt Fehlversuche beim Code und sperrt danach', async () => {
    const { code } = await issue();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await redeemCode({ phone, code: wrong })).ok).toBe(false);
    }
    // Auch der richtige Code hilft jetzt nicht mehr.
    expect(await redeemCode({ phone, code })).toMatchObject({ ok: false });
  });

  it('lehnt einen erfundenen Link ab', async () => {
    expect(await redeemLink('voellig-ausgedacht')).toMatchObject({ ok: false });
  });

  it('lehnt eine unbrauchbare Telefonnummer ab, ohne etwas zu verschicken', async () => {
    const result = await requestLogin({ phone: 'Telefon', ip: '203.0.113.30' });
    expect(result.accepted).toBe(false);
    expect(await lastMessage()).toBe('');
  });
});
