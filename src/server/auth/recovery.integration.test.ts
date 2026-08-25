import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginWithPassword } from './password-login';
import {
  issueRecoveryToken,
  listRecoveryTokens,
  redeemRecoveryToken,
  revokeRecoveryToken,
} from './recovery';

/**
 * Der Notzugang. Regel 41.
 *
 * Geprueft wird das, worauf es ankommt: dass der Token nirgends im Klartext
 * liegt, dass er genau einmal gilt, dass ein Widerruf greift und dass am Ende
 * ein Wechsel des Passworts erzwungen ist — sonst waere der Notzugang ein
 * dauerhafter Zweitschluessel.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Notzugang', () => {
  let sql: ReturnType<typeof postgres>;

  const adminId = `rec-admin-${randomUUID()}`;
  const refereeId = `rec-schiri-${randomUUID()}`;
  const adminPhone = '+4915900000077';
  const name = 'Nele Baumann';
  const start = 'nelebaumann';
  const ip = '203.0.113.77';

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await sql`INSERT INTO referees (id, name, initials, phone, role)
              VALUES (${adminId}, ${name}, ${`R${adminId.slice(-3)}`}, ${adminPhone}, 'admin')`;
    await sql`INSERT INTO referees (id, name, initials, phone, role)
              VALUES (${refereeId}, 'Timo Färber', ${`S${refereeId.slice(-3)}`}, '+4915900000078', 'referee')`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM referees WHERE id IN (${adminId}, ${refereeId})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
    await sql.end();
  });

  beforeEach(async () => {
    await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
    await sql`DELETE FROM admin_recovery_tokens WHERE referee_id IN (${adminId}, ${refereeId})`;
    await sql`DELETE FROM audit_log WHERE subject_id IN (${adminId}, ${refereeId})`;
  });

  it('stellt einen Token aus, der lang genug ist, um nicht erraten zu werden', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');
    expect(token.length).toBe(64);
  });

  it('legt den Token nirgends im Klartext ab — Regel 39', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');

    const rows = await sql`SELECT * FROM admin_recovery_tokens WHERE referee_id = ${adminId}`;
    expect(JSON.stringify(rows)).not.toContain(token);

    const log = await sql`SELECT * FROM audit_log WHERE subject_id = ${adminId}`;
    expect(JSON.stringify(log)).not.toContain(token);
  });

  it('lässt einen ausgesperrten Admin wieder herein', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');
    const result = await redeemRecoveryToken({ token, ip });

    expect(result.ok).toBe(true);
    expect(result.ok && result.refereeId).toBe(adminId);
    expect(result.ok && result.startPassword).toBe(start);
  });

  it('erzwingt danach ein eigenes Passwort — sonst wäre es ein Zweitschlüssel', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');
    await redeemRecoveryToken({ token, ip });

    const login = await loginWithPassword({ phone: adminPhone, password: start, ip });
    expect(login.ok).toBe(true);
    expect(login.ok && login.mustChangePassword).toBe(true);
  });

  it('gilt genau einmal', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');
    expect((await redeemRecoveryToken({ token, ip })).ok).toBe(true);

    const zweitens = await redeemRecoveryToken({ token, ip });
    expect(zweitens.ok).toBe(false);
  });

  it('gilt nach einem Widerruf nicht mehr', async () => {
    const { id, token } = await issueRecoveryToken(adminId, 'Tresor');
    expect(await revokeRecoveryToken(id)).toBe(true);
    expect((await redeemRecoveryToken({ token, ip })).ok).toBe(false);
    // Ein zweiter Widerruf ändert nichts mehr.
    expect(await revokeRecoveryToken(id)).toBe(false);
  });

  it('weist einen erfundenen Token ab — mit derselben Antwort wie einen verbrauchten', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');
    await redeemRecoveryToken({ token, ip });

    const verbraucht = await redeemRecoveryToken({ token, ip });
    const erfunden = await redeemRecoveryToken({ token: 'a'.repeat(64), ip });
    expect(verbraucht.ok).toBe(false);
    expect(erfunden.ok).toBe(false);
    expect(verbraucht.ok === false && verbraucht.message).toBe(
      erfunden.ok === false && erfunden.message,
    );
  });

  it('gilt nur für einen Admin', async () => {
    await expect(issueRecoveryToken(refereeId, 'Tresor')).rejects.toThrow(/Admin/);
  });

  it('gilt nicht mehr, wenn dem Konto die Adminrolle entzogen wurde', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');
    await sql`UPDATE referees SET role = 'referee' WHERE id = ${adminId}`;
    const result = await redeemRecoveryToken({ token, ip });
    await sql`UPDATE referees SET role = 'admin' WHERE id = ${adminId}`;
    expect(result.ok).toBe(false);
  });

  it('hält Ausstellen und Einlösen im Prüfprotokoll fest', async () => {
    const { token } = await issueRecoveryToken(adminId, 'Tresor');
    await redeemRecoveryToken({ token, ip });

    const rows = await sql<{ action: string }[]>`
      SELECT action FROM audit_log WHERE subject_id = ${adminId} ORDER BY action`;
    expect(rows.map((row) => row.action)).toContain('recovery.issue');
    expect(rows.map((row) => row.action)).toContain('recovery.redeem');
  });

  it('führt jeden ausgestellten Zugang mit seinem Zustand auf — ohne den Token', async () => {
    const { id, token } = await issueRecoveryToken(adminId, 'Tresor Geschäftsstelle');

    const offen = (await listRecoveryTokens()).find((entry) => entry.id === id);
    expect(offen?.name).toBe(name);
    expect(offen?.label).toBe('Tresor Geschäftsstelle');
    expect(offen?.usedAt).toBeNull();
    expect(JSON.stringify(offen)).not.toContain(token);

    await redeemRecoveryToken({ token, ip });
    const benutzt = (await listRecoveryTokens()).find((entry) => entry.id === id);
    expect(benutzt?.usedAt).not.toBeNull();
  });
});
