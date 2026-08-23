import { describe, expect, it } from 'vitest';
import {
  checkToken,
  CODE_LENGTH,
  hash,
  issueToken,
  loginLink,
  matchesHash,
  MAX_CODE_ATTEMPTS,
  randomCode,
  TOKEN_LIFETIME_MINUTES,
  type StoredToken,
} from './tokens';

const SECRET = 'test-schluessel';
const NOW = new Date('2026-08-01T12:00:00Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60 * 1000);

const stored = (issued = issueToken(SECRET, NOW), overrides: Partial<StoredToken> = {}): StoredToken => ({
  linkTokenHash: issued.linkTokenHash,
  codeHash: issued.codeHash,
  expiresAt: issued.expiresAt,
  usedAt: null,
  attempts: 0,
  ...overrides,
});

describe('Anmeldetoken erzeugen', () => {
  it('gibt Link und Code zusammen aus — beide Wege in einer Nachricht', () => {
    const issued = issueToken(SECRET, NOW);
    expect(issued.linkToken.length).toBeGreaterThanOrEqual(40);
    expect(issued.code).toHaveLength(CODE_LENGTH);
    expect(issued.code).toMatch(/^\d{6}$/);
  });

  it('gilt genau fünfzehn Minuten', () => {
    expect(issueToken(SECRET, NOW).expiresAt).toEqual(minutes(TOKEN_LIFETIME_MINUTES));
  });

  it('erzeugt jedes Mal etwas anderes', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => issueToken(SECRET, NOW).linkToken));
    expect(tokens.size).toBe(50);
  });

  it('speichert nur Ableitungen, nie den Klartext', () => {
    const issued = issueToken(SECRET, NOW);
    expect(issued.linkTokenHash).not.toContain(issued.linkToken);
    expect(issued.codeHash).not.toContain(issued.code);
    // Wer nur die Datenbank hat, kommt ohne den Serverschlüssel nicht weiter.
    expect(hash(issued.code, 'anderer-schluessel')).not.toBe(issued.codeHash);
  });

  it('streut die Codes über alle Ziffern, ohne Schieflage', () => {
    const digits = Array.from({ length: 2000 }, () => randomCode()).join('');
    const counts = new Map<string, number>();
    for (const digit of digits) counts.set(digit, (counts.get(digit) ?? 0) + 1);
    expect(counts.size).toBe(10);
    const expected = digits.length / 10;
    for (const [digit, count] of counts) {
      expect(Math.abs(count - expected) / expected, `Ziffer ${digit}`).toBeLessThan(0.15);
    }
  });
});

describe('Anmeldetoken prüfen', () => {
  it('nimmt den richtigen Link an', () => {
    const issued = issueToken(SECRET, NOW);
    expect(checkToken(stored(issued), { kind: 'link', value: issued.linkToken }, SECRET, NOW).ok).toBe(
      true,
    );
  });

  it('nimmt den richtigen Code an', () => {
    const issued = issueToken(SECRET, NOW);
    expect(checkToken(stored(issued), { kind: 'code', value: issued.code }, SECRET, NOW).ok).toBe(true);
  });

  it('verwechselt Link und Code nicht', () => {
    const issued = issueToken(SECRET, NOW);
    expect(
      checkToken(stored(issued), { kind: 'code', value: issued.linkToken }, SECRET, NOW),
    ).toMatchObject({ ok: false, reason: 'mismatch' });
  });

  it('lehnt nach Ablauf ab — auf die Sekunde', () => {
    const issued = issueToken(SECRET, NOW);
    const presented = { kind: 'link', value: issued.linkToken } as const;
    expect(checkToken(stored(issued), presented, SECRET, minutes(TOKEN_LIFETIME_MINUTES - 1)).ok).toBe(
      true,
    );
    expect(
      checkToken(stored(issued), presented, SECRET, minutes(TOKEN_LIFETIME_MINUTES)),
    ).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('lässt sich nur einmal verwenden', () => {
    const issued = issueToken(SECRET, NOW);
    expect(
      checkToken(
        stored(issued, { usedAt: NOW }),
        { kind: 'link', value: issued.linkToken },
        SECRET,
        NOW,
      ),
    ).toMatchObject({ ok: false, reason: 'used' });
  });

  it('sperrt nach fünf Fehlversuchen — auch bei danach richtigem Code', () => {
    const issued = issueToken(SECRET, NOW);
    expect(
      checkToken(
        stored(issued, { attempts: MAX_CODE_ATTEMPTS }),
        { kind: 'code', value: issued.code },
        SECRET,
        NOW,
      ),
    ).toMatchObject({ ok: false, reason: 'too-many-attempts' });
  });

  it('lehnt einen fremden Serverschlüssel ab', () => {
    const issued = issueToken(SECRET, NOW);
    expect(
      checkToken(stored(issued), { kind: 'link', value: issued.linkToken }, 'fremd', NOW).ok,
    ).toBe(false);
  });

  it('begründet jede Ablehnung mit einem nächsten Schritt', () => {
    const issued = issueToken(SECRET, NOW);
    const cases = [
      checkToken(stored(issued, { usedAt: NOW }), { kind: 'link', value: issued.linkToken }, SECRET, NOW),
      checkToken(stored(issued), { kind: 'code', value: '000000' }, SECRET, NOW),
    ];
    for (const result of cases) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message.length).toBeGreaterThan(10);
    }
  });

  it('vergleicht Hashes ohne Laufzeitunterschied', () => {
    expect(matchesHash('abc', hash('abc', SECRET), SECRET)).toBe(true);
    expect(matchesHash('abd', hash('abc', SECRET), SECRET)).toBe(false);
    expect(matchesHash('abc', 'zu-kurz', SECRET)).toBe(false);
  });
});

describe('Anmeldelink', () => {
  it('baut die Adresse und kodiert den Token', () => {
    expect(loginLink('https://schiriplan.example', 'a+b/c')).toBe(
      'https://schiriplan.example/anmelden/link?token=a%2Bb%2Fc',
    );
  });

  it('verträgt einen Schrägstrich am Ende der Basisadresse', () => {
    expect(loginLink('https://schiriplan.example/', 'x')).toBe(
      'https://schiriplan.example/anmelden/link?token=x',
    );
  });
});
