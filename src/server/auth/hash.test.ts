import { describe, expect, it } from 'vitest';
import { generateRecoveryToken, hashPassword, verifyPassword } from './hash';

/**
 * Regel 39: Passwoerter liegen nur gehasht.
 *
 * Der wichtigste Test hier ist der unscheinbarste: dass das Passwort im
 * gespeicherten Wert nicht vorkommt. Alles andere waere ein Klartextspeicher
 * mit Zusatzschritten.
 */

describe('Regel 39 — gehasht, nie im Klartext', () => {
  it('erkennt das richtige Passwort wieder', async () => {
    const stored = await hashPassword('jonaskeller');
    expect(await verifyPassword('jonaskeller', stored)).toBe(true);
  });

  it('lehnt ein falsches Passwort ab', async () => {
    const stored = await hashPassword('jonaskeller');
    expect(await verifyPassword('jonaskellee', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('enthält das Passwort nirgends im gespeicherten Wert', async () => {
    const stored = await hashPassword('jonaskeller');
    expect(stored).not.toContain('jonaskeller');
    expect(Buffer.from(stored).toString('utf8')).not.toContain('jonaskeller');
  });

  it('ergibt für dasselbe Passwort zwei verschiedene Hashes — je Konto ein eigenes Salz', async () => {
    const [a, b] = await Promise.all([hashPassword('gleich'), hashPassword('gleich')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('gleich', a)).toBe(true);
    expect(await verifyPassword('gleich', b)).toBe(true);
  });

  it('schreibt die Kostenparameter mit, damit sie später erhöht werden können', async () => {
    const stored = await hashPassword('egal');
    const [algorithm, N, r, p] = stored.split('$');
    expect(algorithm).toBe('scrypt');
    expect(Number(N)).toBe(2 ** 15);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it('prüft einen Hash auch dann, wenn er mit anderen Parametern entstanden ist', async () => {
    /*
     * Werden die Kosten später erhöht, müssen die alten Hashes weiter gelten —
     * sonst käme nach dem Update niemand mehr rein.
     */
    const stored = await hashPassword('altmodisch');
    const [, , , , salt, hash] = stored.split('$');
    const schwaecher = ['scrypt', 2 ** 14, 8, 1, salt, hash].join('$');
    // Mit anderen Parametern passt derselbe Klartext nicht mehr — das ist richtig
    // so; entscheidend ist, dass die Prüfung nicht abstürzt.
    expect(await verifyPassword('altmodisch', schwaecher)).toBe(false);
  });
});

describe('Ein unbrauchbarer gespeicherter Wert führt zu einer Ablehnung, nicht zu einem Absturz', () => {
  it.each([
    ['leer', ''],
    ['ohne Trennzeichen', 'jonaskeller'],
    ['falsches Verfahren', 'bcrypt$1$2$3$abc$def'],
    ['zu wenige Teile', 'scrypt$16384$8$1$abc'],
    ['unlesbare Zahlen', 'scrypt$viel$acht$eins$abc$def'],
    ['leerer Hash', 'scrypt$16384$8$1$abc$'],
  ])('%s', async (_name, stored) => {
    expect(await verifyPassword('jonaskeller', stored)).toBe(false);
  });
});

describe('Regel 41 — der Notzugangs-Token', () => {
  it('ist lang genug, um nicht erraten zu werden', () => {
    const token = generateRecoveryToken();
    // 48 zufällige Bytes ergeben 64 Zeichen in Base64url.
    expect(token.length).toBe(64);
  });

  it('ist bei jedem Aufruf ein anderer', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateRecoveryToken()));
    expect(tokens.size).toBe(20);
  });

  it('enthält nur Zeichen, die sich notieren und vorlesen lassen', () => {
    expect(generateRecoveryToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
