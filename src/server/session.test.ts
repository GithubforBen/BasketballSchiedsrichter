import { describe, expect, it } from 'vitest';
import { createSession, readSession, SESSION_MAX_AGE_SECONDS } from './session';

const SECRET = 'test-schluessel-nur-fuer-tests';
const NOW = new Date('2026-08-01T12:00:00Z');
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe('Sitzungscookie', () => {
  it('liest zurück, was es geschrieben hat', () => {
    const cookie = createSession({ refereeId: 'r-jk', role: 'referee' }, SECRET, NOW);
    expect(readSession(cookie, SECRET, NOW)).toMatchObject({
      refereeId: 'r-jk',
      role: 'referee',
    });
  });

  it('lehnt eine Signatur ab, die mit einem anderen Schlüssel entstand', () => {
    const cookie = createSession({ refereeId: 'r-jk', role: 'referee' }, SECRET, NOW);
    expect(readSession(cookie, 'anderer-schluessel', NOW)).toBeNull();
  });

  it('lehnt einen veränderten Inhalt ab', () => {
    const cookie = createSession({ refereeId: 'r-jk', role: 'referee' }, SECRET, NOW);
    const [body, signature] = cookie.split('.');
    const tampered = Buffer.from(
      JSON.stringify({ refereeId: 'r-jk', role: 'admin', exp: 9_999_999_999 }),
    ).toString('base64url');
    expect(readSession(`${tampered}.${signature ?? ''}`, SECRET, NOW)).toBeNull();
    expect(body).toBeDefined();
  });

  it('kann eine Rolle nicht heraufsetzen', () => {
    // Der haeufigste Angriff: Rolle im Cookie auf "admin" biegen.
    const cookie = createSession({ refereeId: 'r-jk', role: 'referee' }, SECRET, NOW);
    const session = readSession(cookie, SECRET, NOW);
    expect(session?.role).toBe('referee');
  });

  it('läuft nach dreißig Tagen ab', () => {
    const cookie = createSession({ refereeId: 'r-jk', role: 'referee' }, SECRET, NOW);
    expect(readSession(cookie, SECRET, later(SESSION_MAX_AGE_SECONDS - 1))).not.toBeNull();
    expect(readSession(cookie, SECRET, later(SESSION_MAX_AGE_SECONDS))).toBeNull();
    expect(readSession(cookie, SECRET, later(SESSION_MAX_AGE_SECONDS + 1))).toBeNull();
  });

  it('lehnt Unfug still ab, ohne den Grund zu verraten', () => {
    for (const value of ['', 'kaputt', 'a.b.c', '.signatur', 'nurtext.']) {
      expect(readSession(value, SECRET, NOW)).toBeNull();
    }
    expect(readSession(undefined, SECRET, NOW)).toBeNull();
  });

  it('lehnt einen unbekannten Rollennamen ab', () => {
    const body = Buffer.from(
      JSON.stringify({ refereeId: 'r-jk', role: 'superadmin', exp: 9_999_999_999 }),
    ).toString('base64url');
    // Auch korrekt signiert bleibt eine unbekannte Rolle ungültig.
    const cookie = createSession({ refereeId: 'r-jk', role: 'referee' }, SECRET, NOW);
    const signature = cookie.split('.')[1] ?? '';
    expect(readSession(`${body}.${signature}`, SECRET, NOW)).toBeNull();
  });
});
